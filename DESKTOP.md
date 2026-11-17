# HAPPY BIRTHDAY PO! — Windows Desktop EXE

A **portable, offline** Windows desktop build of the same birthday app. No installer. No admin rights. No network.

## What it is

- `C:\Birthday-Surprise\dist\SagingNgPagmamahal\
  - `SagingNgPagmamahal.exe` — the launcher (5.3 MB)
  - `_internal\` — the Python/WebView2 runtime (~21 MB)
  - `app\` — the full app + all Owner content (113 MB: messages, pictures, videos, bananaque PNG)

Total: **~140 MB**, 180 files, self-contained.

## Requirements

- Windows 10 or 11 with Microsoft Edge WebView2 Runtime (already installed on virtually all Windows 10/11 machines — it is part of Edge).
- No Python, no Node, no internet, no browser window.

## How to launch

1. Copy the `SagingNgPagmamahal` folder anywhere (another drive, a USB stick, the desktop).
2. Double-click `SagingNgPagmamahal.exe`.
3. The window opens straight onto the bananaque screen. Tap it → random message, picture, or video. Close it, or tap "Another surprise ♡".

## How to rebuild after changing content

```powershell
cd C:\Birthday-Surprise
python tools\build_desktop.py          # re-parses messages, discovers media, rebuilds desktop_build\
pyinstaller --noconsole --onedir --name SagingNgPagmamahal --icon desktop_build\bananaque.ico --distpath dist --workpath build\pyi_work --clean desktop_build\launcher.py
Remove-Item dist\SagingNgPagmamahal\app -Recurse -Force
Copy-Item desktop_build\app dist\SagingNgPagmamahal\app -Recurse -Force
```

(pyinstaller is installed in `.venv-build` — see the build log if needed.)

## What is different from the PWA

| | Web PWA (`localhost:8080`) | Desktop EXE |
|---|---|---|
| Requires | Browser + (first) internet visit to cache | Just double-click, anywhere on disk |
| Network | Only for first-ever load / media fetch | Never |
| Look | Browser chrome optional | Native window, no browser UI |
| Content | Same 401 messages, 81 pictures, 34 videos, bananaque PNG | Identical, embedded |
| Fallback | Service-worker cache | Direct file access via WebView2 |

The desktop build embeds everything (`js/content-data.js`) and loads files directly from disk — no fetch, no network, no loading spinner. Messages parse instantly from the embedded JSON.

## Safety notes

- Original Owner content in `content\` is never modified.
- The desktop build is separate: the PWA still works untouched.
- Do not delete `_internal\` or `app\` — they are required at runtime.
