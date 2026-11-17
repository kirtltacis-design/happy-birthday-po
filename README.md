# HAPPY BIRTHDAY PO!
### HAPPY BIRTHDAY PO!

A single-screen pixel-art-meets-realistic birthday gift. No menus, no settings, no fuss:

**Open the app → see the kamote cue → tap it → receive a random surprise (message or picture) → close it or get another one.**

The background is charming pixel art; the kamote cue itself is the Owner's real photograph.
Built with **vanilla HTML, CSS and JavaScript**. No frameworks, no build step, no accounts,
no servers, no tracking, no external runtime dependencies.

> **Status:** the app runs locally. **Do not publish or deploy without the Owner's separate authorization.**

---

## 1. Project layout

```
C:\Birthday-Surprise\
├── index.html                 # The one and only screen (pixel-art scene + kamote cue)
├── manifest.webmanifest       # PWA manifest (installable)
├── sw.js                      # Service worker (offline-first precaching)
├── css\styles.css             # Single-screen styles (mobile-first)
├── js\
│   ├── app.js                 # Taps, sparkles, wiggle, sound, catalog loading, overlay lifecycle
│   ├── content-parser.js      # TXT message parser (paragraph & numbered-list modes) — testable
│   ├── surprise-picker.js     # 3-type weighted picker (exhaust-then-reset) — testable
├── content\
│   ├── messages\              # ← OWNER'S MESSAGE TXT FILE GOES HERE (required for messages)
│   │     PUT_YOUR_MESSAGES_TXT_HERE.txt   (instructions; ignored by the app)
│   ├── media\images\          # ← OWNER'S PICTURES GO HERE
│   ├── media\videos\          # ← OWNER'S VIDEOS GO HERE
│   ├── kamote.jpg            # ← OWNER'S SUPPLIED KAMOTE CUE PHOTOGRAPH (source of truth)
│   ├── README.md              # Where everything goes, formats, offline notes
│   └── catalog.json           # Auto-generated index (python tools\build-catalog.py)
├── assets\
│   ├── img\kamote.png          # Kamote cue photograph, background removed (derived from content/kamote.jpg)
│   ├── img\surprises\
│   │     dev-placeholder-hearts.svg       # ⚠️ TEMPORARY placeholders — replace with real content
│   │     dev-placeholder-bananaque.svg
│   │     dev-placeholder-sampaguita.svg
│   ├── icons\                 # App icons (192, 512, maskable 512, apple-touch, favicons)
│   └── fonts\                 # Locally packaged OFL fonts: Press Start 2P, Nunito
├── tools\
│   ├── generate_sprites.py  # Regenerates icons (Python 3 stdlib only)
│   ├── make_bananaque.py    # Regenerates the development bananaque PNG (Pillow + numpy)
│   ├── build-catalog.py     # Scans content/ and regenerates content/catalog.json
│   └── remove_bananaque_background.py  # White-background removal for a bananaque-style photo
│   └── remove_kamote_background.py     # White-background removal for the Owner's kamote.jpg
├── tests\run-tests.js         # 279 automated checks (Node, zero dependencies)
└── README.md
```

---

## 2. Exact local launch command

Service workers require **localhost or HTTPS** (never `file://`).

```powershell
cd C:\Birthday-Surprise
python -m http.server 8080 --bind 127.0.0.1
```

**Local preview URL:** <http://localhost:8080>

---

## 3. How surprises work

**Open → Tap → Surprise.** The kamote cue (or the "TAP THIS KAMOTE CUE ♡" button) triggers:
a wiggle animation → a sparkle burst → one randomly drawn surprise shown on the same screen.

Content lives in **`content/`** — messages, pictures and videos, all mixed into one roulette:

- **Messages:** drop the Owner's `.txt` into `content\messages\`. Formats (auto-detected):
  paragraph blocks separated by blank lines, or one message per line (numbered/bulleted
  lists OK — numbering/bullets are stripped). Wording, emojis and punctuation are preserved.
  See `content\messages\PUT_YOUR_MESSAGES_TXT_HERE.txt` for exact examples.
- **Pictures:** copy into `content\media\images\` — PNG, JPG/JPEG, WebP, GIF, BMP, AVIF. Shown fully, never cropped.
- **Videos:** copy into `content\media\videos\` - MP4 (H.264/AAC, recommended) or WebM. They play only after a tap, with controls, never autoplay, and stop when the card closes. The next video candidate streams in the background as a hidden, preloaded element so playback can start instantly when a video surprise is drawn — without storing the whole collection on-device.
- **Kamote cue picture:** the app uses `content\kamote.jpg`, processed into `assets\img\kamote.png` with the background removed (white background removed on processing — see `content\README.md`).

**Details & guarantees:**

- A **balanced roulette** — default ⅓ chance each of message / picture / video (configurable via `window.SURPRISE_WEIGHTS` in `js/app.js`; no settings screen). A type with zero entries donates its share to the remaining types.
- **No immediate repeats** while an alternative exists, and per-type **exhaust-then-reset** cycling so entries are seen before repeats happen.
- **Offline:** messages and pictures are cached by the service worker after their first online fetch (the first-launch preparation verifies them). Videos are streamed on demand: only the *next* video candidate is buffered in a hidden element, and it plays from the browser's temporary media buffer — the full video collection is never downloaded or permanently stored at launch (iPhone storage).
- **Console diagnostics:** the app logs exactly how many of each type it found (`[HAPPY BIRTHDAY PO!] content (catalog): 45 messages · 12 pictures · 3 videos`).
- The Owner never touches code: copy files into the folder, reload once (with internet the first time a new file is fetched), done. `python tools\build-catalog.py` regenerates `content\catalog.json` if you want to force a refresh.

---

## 4. How the offline-first app works

1. **The first visit must be online.** `sw.js` precaches the app shell (HTML,
   CSS, JS, fonts, the kamote cue image, icons). The first-launch preparation verifies
   every picture into the media cache, and the next video candidate buffers in the
   background — nothing else is downloaded.
2. Afterwards everything is served from cache — kamote cue taps, surprise drawing,
   images, sounds. No network required.
3. Navigations are network-first with an error-guard: if the network fails *or returns
   an error page*, the cached app is served instead.
4. Bump `CACHE_VERSION` in `sw.js` after any packaged-file change.

**Honest limitations:** the first load needs internet; iOS can evict web-app storage
under pressure (re-installing or revisiting online re-caches); `file://` never works for
service workers; `navigator.onLine` cannot detect a reachable-but-down origin.

---

## 5. Installing on Android
1. Visit the site once online in Chrome; confirm it fully loads.
2. Chrome menu (⋮) → **Install app** / **Add to Home screen**.
3. Launch from the home-screen icon; toggle airplane mode; verify: opens, tap works,
   surprises draw, images render, sounds play.

## 6. Installing on iPhone / iPad
1. Visit the site once online in **Safari** (required).
2. Share button → **Add to Home Screen** → **Add**.
3. Launch from the home-screen icon; airplane mode on; verify the same checklist.

---

## 7. Accessibility & UX notes

- The kamote cue and the instruction are real `<button>`s, keyboard-operable; the
  instruction triggers the same tap ritual.
- The surprise card is a labelled `role="dialog"` with `inert` while closed, focus moved
  in on open, `Escape`/backdrop/close button to dismiss, focus returned to the trigger.
- `prefers-reduced-motion` disables ambient hearts and long animations.
- Sounds are synthesized locally (Web Audio) only after a user gesture — never autoplay.
- Pixel art renders with `image-rendering: pixelated` (crisp, unblurred edges).
- Responsive: phone, tablet, desktop; large touch targets; no horizontal overflow.

---

## 8. Validation & tests

```powershell
node tests\run-tests.js
```

279 checks: message parser (both formats, edge cases), 3-type picker (fairness, fallback,
exhaustion, no-repeat), content-catalog contract + placeholder exclusion, video lifecycle
wiring, single-screen HTML (removed UI confirmed absent), CSS (reduced motion, no pixelated
kamote cue, card overflow, safe areas, video styles), service-worker precache +
network-first catalog + runtime content caching, manifest sanity, zero external URLs.

---

## 9. Desktop EXE (optional)

A fully offline Windows portable build is available too:
`dist\SagingNgPagmamahal\SagingNgPagmamahal.exe`

It opens the same single-screen app, with all content bundled beside the EXE. See **DESKTOP.md** for how to launch and how to rebuild it after content changes.

---

## 10. Deployment preparation (NOT done — requires Owner authorization)

1. Host the folder on any static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages…).
2. Keep relative paths as-is; HTTPS is mandatory for the service worker.
3. Serve correct MIME types (`application/javascript`, `application/manifest+json`,
   `font/ttf`, `image/svg+xml`). Bump `CACHE_VERSION` after any file change.
4. Re-run tests; re-test install flows on one Android and one iPhone.

**No deployment has been performed. No paid services are used.**
