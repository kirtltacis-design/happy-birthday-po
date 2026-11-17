# 📁 Content Folder — Where Everything Goes

Put your content here. No code edits are ever needed. When you add or change files,
just reload the app (an internet connection is needed only the first time each new
file is fetched, so it can be cached for offline use).

```
content\
├── messages\
│     PUT_YOUR_MESSAGES_TXT_HERE.txt   ← replace this with the Owner's .txt file
├── media\
│   ├── images\
│   │      ← OWNER'S PICTURES GO HERE
│   └── videos\
│          ← OWNER'S VIDEOS GO HERE
├── bananaque-source\
│      ← OWNER'S ORIGINAL BANANAQUE PICTURE GOES HERE
└── README.md                          ← this file
```

## Messages

**Location:** `content\messages\`

Drop exactly one `.txt` file here (you can replace it later — the app always reads it fresh).

- Encoding: **UTF-8**.
- Separate messages with **blank lines** (paragraph mode) or write **one per line**
  (numbered/bulleted lists are fine — numbering/bullets are stripped automatically).
- Your wording, punctuation, emojis and line breaks are preserved exactly as written.
- Every message becomes an individual surprise. Nothing is merged, nothing is invented.
- See `PUT_YOUR_MESSAGES_TXT_HERE.txt` in that folder for examples.
- The app reports in the browser console how many messages it read (`[HAPPY BIRTHDAY PO!] messages: 45`).

## Pictures

**Location:** `content\media\images\`

Supported: **PNG, JPG / JPEG, WebP, GIF, BMP, AVIF** (whatever the browser can display).

- Copy files in — no renaming, no code.
- Any size and aspect ratio; pictures are shown **fully, never cropped**.
- Recommended: ≤ 5 MB each (large photos are fine, but they use more storage when cached).
- File names may contain spaces — the app handles them.

## Videos

**Location:** `content\media\videos\`

Supported: **MP4 (H.264 video + AAC audio) — recommended**, **WebM**, and **MOV/M4V** if the browser can play them.

- Copy files in — no renaming, no code.
- Recommended: **H.264 MP4** (plays everywhere, including iPhone Safari), ≤ 20 MB per video.
- Videos play **only after Alexis taps** — never on their own. They appear with
  play/pause/volume controls and can be replayed.
- Closing the card or drawing another surprise stops the video and releases it.
- Unsupported formats get a friendly fallback message instead of a broken player.

## Bananaque picture (the big one)

**Location:** `content\bananaque-source\`

Drop the Owner's original bananaque picture here (PNG or JPG, any name). Once it is
there, it will be processed into `assets\img\bananaque.png` with the white background
removed (transparent cut-out) and the app will show exactly that picture.

## Offline use

Everything above works **offline** after each file has been fetched once while online
(the service worker caches it). Very large videos use phone storage for caching — if a
video is over ~25 MB we'll flag it when we process it.

## If a message count looks wrong

1. Reopen the app with the browser console open (F12).
2. Look for `[HAPPY BIRTHDAY PO!] content:` lines — they report exactly how many messages,
   pictures and videos were discovered.
3. Check the file is UTF-8 and `.txt`, inside `content\messages\`.
