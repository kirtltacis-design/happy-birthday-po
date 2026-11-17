/* ============================================================================
   HAPPY BIRTHDAY PO! — Application logic (single-screen experience)
   Tap the kamote cue → sparkle → reveal a random surprise:
   a message, a picture, or a video — 1/3 each by default.
   ========================================================================== */

(function () {
  'use strict';

  var DESKTOP_CONTENT = window.SAGING_CONTENT || null;
  var WEIGHTS = window.SURPRISE_WEIGHTS || { message: 1, image: 1, video: 1 };

  var state = {
    entries: [],            // [{id, type:'message'|'image'|'video', text?, src?, name?}]
    contentReady: false,
    mediaReady: false,
    mediaList: [],
    prepRunning: false,
    failedFiles: [],
    contentError: false,
    contentSource: 'pending' // 'catalog' | 'listings' | 'desktop' | 'empty'
  };

  var picker = window.SagingPicker.createPicker({
    getEntries: function () { return state.entries; },
    weights: WEIGHTS,
    rng: Math.random
  });

  var lastTrigger = null;
  var currentVideo = null;

  /* ---------------- tiny helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function isReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  var IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'];
  var VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.gif'];
  var TEXT_EXT  = ['.txt'];
  var PLACEHOLDER_PREFIX = 'PUT_YOUR_';

  function extOf(name) {
    var i = String(name).lastIndexOf('.');
    return i === -1 ? '' : String(name).slice(i).toLowerCase();
  }
  function isContentFile(name, exts) {
    if (!name) return false;
    var upper = String(name).toUpperCase();
    if (upper.indexOf(PLACEHOLDER_PREFIX) === 0) return false;
    return exts.indexOf(extOf(name)) !== -1;
  }
  function hashId(text) {
    if (window.SagingParser && SagingParser.hash) return SagingParser.hash(text);
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  /* ---------------- audio (synth, never autoplays) ---------------- */
  var audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freqA, freqB, dur, type, gain, when) {
    var ac = ctx(); if (!ac) return;
    var t0 = ac.currentTime + (when || 0);
    var osc = ac.createOscillator();
    var g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freqA, t0);
    if (freqB && freqB !== freqA) osc.frequency.exponentialRampToValueAtTime(freqB, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  var SOUND_ON_KEY = 'saging.soundOn';
  function isSoundOn() {
    try { var v = localStorage.getItem(SOUND_ON_KEY); return v === null ? true : v === '1'; } catch (e) { return true; }
  }
  function playSound(name) {
    if (!isSoundOn()) return;
    try {
      switch (name) {
        case 'pop':   tone(760, 430, 0.16, 'triangle', 0.16, 0); break;
        case 'chime': tone(1318, 1318, 0.42, 'sine', 0.10, 0); tone(1760, 1760, 0.5, 'sine', 0.08, 0.09); break;
        case 'click': tone(1150, 900, 0.06, 'square', 0.05, 0); break;
      }
    } catch (e) { /* audio unavailable — stay silent */ }
  }

  /* ---------------- sparkles & hearts ---------------- */
  function spawnSparkles(originX, originY) {
    if (isReducedMotion()) return;
    var layer = $('sparkleLayer');
    var colors = ['', 'white', 'pink'];
    for (var i = 0; i < 11; i++) {
      var s = el('span', 'sparkle ' + colors[Math.floor(Math.random() * colors.length)]);
      var angle = Math.random() * Math.PI * 2;
      var dist = 46 + Math.random() * 82;
      s.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(angle) * dist - 24).toFixed(1) + 'px');
      s.style.left = originX + 'px';
      s.style.top = originY + 'px';
      s.style.animationDelay = (Math.random() * 0.18).toFixed(2) + 's';
      layer.appendChild(s);
      (function (node) {
        node.addEventListener('animationend', function () { node.remove(); });
        setTimeout(function () { if (node.parentNode) node.remove(); }, 1600);
      })(s);
    }
  }
  function spawnTapRing(x, y) {
    if (isReducedMotion()) return;
    var ring = el('span', 'tap-ring');
    ring.style.left = (x - 10) + 'px';
    ring.style.top = (y - 10) + 'px';
    $('sparkleLayer').appendChild(ring);
    ring.addEventListener('animationend', function () { ring.remove(); });
  }
  var HEART_COLORS = ['#e89bb4', '#d96f92', '#d64541', '#f4b8c9', '#ffc9a3'];
  function spawnAmbientHeart() {
    if (isReducedMotion() || document.hidden) return;
    var layer = $('ambientLayer');
    if (!layer || layer.childElementCount >= 6) return;
    var heart = el('span', 'ambient-heart');
    var size = 13 + Math.random() * 15;
    heart.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.5-9.5-9C1 7.8 3.4 4.5 7 4.5c2.2 0 3.9 1.2 5 3 1.1-1.8 2.8-3 5-3 3.6 0 6 3.3 4.5 6.5-2.5 4.5-9.5 9-9.5 9z" fill="' + HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)] + '"/></svg>';
    heart.style.left = (4 + Math.random() * 88) + '%';
    heart.style.setProperty('--drift', (Math.random() * 80 - 40).toFixed(0) + 'px');
    heart.style.setProperty('--heart-opacity', (0.45 + Math.random() * 0.45).toFixed(2));
    heart.style.animationDuration = (6.5 + Math.random() * 4.5).toFixed(2) + 's';
    layer.appendChild(heart);
    heart.addEventListener('animationend', function () { heart.remove(); });
    setTimeout(function () { if (heart.parentNode) heart.remove(); }, 12000);
  }

  /* ---------------- first-launch media preparation ---------------- */
  var MEDIA_CACHE = 'saging-media-v1';
  var PREP_STATE_KEY = 'saging.mediaPrep.v1';
  var PREP_RAN = 'saging.mediaPrepRan.v1';

  var prep = {
    overlay: null, status: null, fill: null, bar: null,
    done: null, total: null, current: null,
    failBox: null, failCount: null, failList: null,
    retryBtn: null, readyTitle: null, enterBtn: null
  };

  function loadPrepState() {
    try { return JSON.parse(localStorage.getItem(PREP_STATE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function savePrepState(s) {
    try { localStorage.setItem(PREP_STATE_KEY, JSON.stringify(s)); } catch (e) { /* storage full */ }
  }

  async function openMediaCache() {
    if (openMediaCache._cache) return openMediaCache._cache;
    openMediaCache._cache = await caches.open(MEDIA_CACHE);
    return openMediaCache._cache;
  }

  async function cachedFileSize(cache, url) {
    try {
      var resp = await cache.match(url);
      if (!resp) return 0;
      // blob() does not copy the bytes into JS memory — it is the cheap,
      // reliable way to learn the stored size on every device, including iPhone.
      var b = await resp.blob().catch(function () { return null; });
      return b ? b.size : 0;
    } catch (e) { return 0; }
  }

  function grabPrepEls() {
    prep.overlay    = $('prepOverlay');
    prep.status     = $('prepStatus');
    prep.fill       = $('prepFill');
    prep.bar        = $('prepBar');
    prep.done       = $('prepDone');
    prep.total      = $('prepTotal');
    prep.current    = $('prepCurrent');
    prep.failBox    = $('prepFailBox');
    prep.failCount  = $('prepFailCount');
    prep.failList   = $('prepFailList');
    prep.retryBtn   = $('prepRetryBtn');
    prep.readyTitle = $('prepReadyTitle');
    prep.enterBtn   = $('prepEnterBtn');
    if (prep.retryBtn) prep.retryBtn.addEventListener('click', function () {
      prep.failBox.hidden = true;
      runPreparation(true);
    });
    if (prep.enterBtn) prep.enterBtn.addEventListener('click', function () {
      hidePrepOverlay();
      focusKamote();
    });
  }

  function showPrepOverlay() {
    if (!prep.overlay) return;
    prep.overlay.hidden = false;
    prep.overlay.setAttribute('aria-hidden', 'false');
    prep.overlay.inert = false;
    prep.overlay.classList.add('is-open');
  }
  function hidePrepOverlay() {
    if (!prep.overlay) return;
    prep.overlay.classList.remove('is-open');
    prep.overlay.setAttribute('aria-hidden', 'true');
    prep.overlay.inert = true;
    prep.overlay.hidden = true;
  }
  function focusKamote() {
    var btn = $('kamoteBtn');
    if (btn && btn.focus) btn.focus({ preventScroll: true });
  }
  function resetPrepUI() {
    prep.failBox.hidden = true;
    prep.readyTitle.hidden = true;
    prep.enterBtn.hidden = true;
    prep.status.textContent = 'Preparing your surprises…';
    prep.current.textContent = '';
    prep.fill.style.width = '0%';
    prep.bar.setAttribute('aria-valuenow', '0');
  }
  function updatePrepUI(doneCount, totalCount, currentFile, failedCount) {
    var pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    prep.done.textContent = String(doneCount);
    prep.total.textContent = String(totalCount);
    prep.fill.style.width = pct + '%';
    prep.bar.setAttribute('aria-valuenow', String(pct));
    prep.current.textContent = currentFile || '';
    if (failedCount > 0) {
      prep.failBox.hidden = false;
      prep.failCount.textContent = String(failedCount);
    }
  }

  /** fetch with an upper-bound timeout so a stalled transfer rejects instead of
      hanging the whole preparation forever (the classic iPhone symptom). */
  function fetchWithTimeout(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = null;
      var AC = window.AbortController;
      var ctrl = AC ? new AC() : null;
      var finish = function (fn, value) {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        fn(value);
      };
      timer = setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) { /* older engines */ } }
        finish(reject, new Error('timed out after ' + timeoutMs + 'ms'));
      }, timeoutMs);
      var opts = { cache: 'default' };
      if (ctrl) opts.signal = ctrl.signal;
      fetch(url, opts).then(function (r) { finish(resolve, r); }, function (err) { finish(reject, err); });
    });
  }

  /** Stream one file straight from the network into the Cache API.
      No intermediate arrayBuffer copy; verifies the STORED size against the
      network Content-Length (or the stored blob size) before accepting it. */
  function downloadOne(cache, url) {
    return fetchWithTimeout(url, 60000).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var expected = parseInt(response.headers.get('content-length') || '0', 10) || 0;
      // Stream the response body directly into the Cache API — no JS memory copy.
      return cache.put(url, response).then(function () {
        return cache.match(url).then(function (stored) {
          return blobSize(stored).then(function (got) {
            if (got <= 0) throw new Error('stored 0 bytes');
            if (expected > 0 && got !== expected) {
              throw new Error('size mismatch: stored ' + got + ' vs expected ' + expected);
            }
            return got;
          });
        });
      });
    });
  }
  function blobSize(resp) {
    if (!resp) return Promise.resolve(0);
    return resp.blob().then(function (b) { return b ? b.size : 0; }, function () { return 0; });
  }

  /** Download one file with limited retries; rejects after the last attempt. */
  async function downloadWithRetry(cache, url, attempts) {
    var lastErr = null;
    for (var attempt = 1; attempt <= attempts; attempt++) {
      try { return await downloadOne(cache, url); }
      catch (err) {
        lastErr = err;
        console.warn('[HAPPY BIRTHDAY PO!] prep attempt ' + attempt + '/' + attempts + ' failed:', url, err && err.message);
        if (attempt < attempts) await new Promise(function (r) { setTimeout(r, 800 * attempt); });
      }
    }
    throw lastErr || new Error('download failed');
  }

  /** Returns true if every catalogued media file is present in the media cache. */
  async function allFilesCached(files) {
    var cache = await openMediaCache();
    for (var i = 0; i < files.length; i++) {
      var size = await cachedFileSize(cache, files[i]);
      if (size <= 0) return false;
    }
    return true;
  }

  /** Download + verify every media file into the media cache. */
  async function runPreparation(isRetry) {
    if (state.prepRunning) return;
    var files = state.mediaList.slice();
    var total = files.length;
    if (total === 0) { setMediaReady(); return; }

    state.prepRunning = true;
    showPrepOverlay();
    resetPrepUI();
    updatePrepUI(0, total, '', 0);

    var cache = await openMediaCache();
    var saved = loadPrepState();
    var done = 0;
    var failed = [];

    // pass 1: already-cached files
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var existing = await cachedFileSize(cache, f);
      if (existing > 0) { saved[f] = { b: existing, at: Date.now() }; done++; updatePrepUI(done, total, '', 0); }
    }

    // pass 2: download missing/failed — small concurrency pool, per-file retries,
    // sequential cache writes are unnecessary; every file is verified in the Cache API.
    var quotaHit = false;
    var todo = [];
    for (var j = 0; j < files.length; j++) {
      var url = files[j];
      var have = await cachedFileSize(cache, url);
      if (have > 0) continue;
      todo.push(url);
    }

    var CONCURRENCY = 4;
    var cursor = 0;
    var workers = [];
    for (var w = 0; w < CONCURRENCY; w++) {
      workers.push((function () {
        return (async function () {
          while (true) {
            if (quotaHit) return;
            var idx = cursor;
            cursor++;
            if (idx >= todo.length) return;
            var url = todo[idx];
            try {
              var got = await downloadWithRetry(cache, url, 3);
              saved[url] = { b: got, at: Date.now() };
              done++;
            } catch (err) {
              var isQuota = err && /quota|not enough|exceeded/i.test(String(err.message || err));
              if (isQuota) { quotaHit = true; failed.push(url); }
              else failed.push(url);
            }
            savePrepState(saved);
            updatePrepUI(done, total, url.split('/').pop(), failed.length);
          }
        })();
      })());
    }
    await Promise.all(workers);
    if (quotaHit) {
      for (var k = cursor; k < todo.length; k++) failed.push(todo[k]);
    }

    state.failedFiles = failed;

    if (quotaHit) {
      prep.status.textContent = 'Not enough storage on this device.';
      prep.current.textContent = 'Free up some space, then tap Retry.';
      prep.failBox.hidden = false;
      prep.failCount.textContent = String(failed.length);
      prep.failList.textContent = '\u2026' + failed.length + ' file(s) not saved. Free storage and retry.';
      state.prepRunning = false;
      return;
    }

    if (failed.length > 0) {
      prep.status.textContent = 'Almost ready — a few files need another try.';
      prep.failBox.hidden = false;
      prep.failCount.textContent = String(failed.length);
      prep.failList.textContent = failed.slice(0, 8).map(function (f) { return '• ' + f.split('/').pop(); }).join('\n');
      state.prepRunning = false;
      return;
    }

    savePrepState(saved);
    state.prepRunning = false;
    finishPreparation();
  }

  function finishPreparation() {
    try { localStorage.setItem(PREP_RAN, '1'); } catch (e) {}
    state.mediaReady = true;
    prep.status.textContent = 'Ready for your birthday surprises!';
    prep.readyTitle.hidden = false;
    prep.enterBtn.hidden = false;
    prep.current.textContent = '';
    prep.fill.style.width = '100%';
    prep.bar.setAttribute('aria-valuenow', '100');
    window.setTimeout(function () { hidePrepOverlay(); focusKamote(); }, 900);
  }

  function setMediaReady() {
    try { localStorage.setItem(PREP_RAN, '1'); } catch (e) {}
    state.mediaReady = true;
    hidePrepOverlay();
  }

  function showPreparationNeeded() {
    if (!prep.overlay) grabPrepEls();
    showPrepOverlay();
    prep.status.textContent = 'One tiny moment — getting everything ready…';
  }

  async function bootMediaPrep() {
    if (!prep.overlay) grabPrepEls();
    // Desktop build: everything is already on disk — always ready.
    if (DESKTOP_CONTENT) { setMediaReady(); return; }
    if (state.mediaList.length === 0) { setMediaReady(); return; }
    try {
      var allCached = await allFilesCached(state.mediaList);
      if (allCached) { setMediaReady(); return; }
    } catch (e) { /* fall through to download */ }
    runPreparation(false);
  }

  /* ---------------- surprising content loading ---------------- */
  async function fetchJSON(url) {
    var response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error('fetch failed: ' + url + ' (' + response.status + ')');
    return response.json();
  }
  async function fetchText(url) {
    var response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error('fetch failed: ' + url + ' (' + response.status + ')');
    return response.text();
  }

  function entriesFromCatalog(catalog) {
    var jobs = [];
    (catalog.messages || []).filter(function (f) { return isContentFile(f, TEXT_EXT); }).forEach(function (file) {
      jobs.push(fetchText('content/messages/' + file).then(function (text) {
        var parsed = window.SagingParser.parseMessages(text);
        return parsed.messages.map(function (m) {
          return { id: 'msg-' + hashId(file + '#' + m.id + m.text), type: 'message', text: m.text };
        });
      }).catch(function (err) {
        console.warn('[HAPPY BIRTHDAY PO!] message file skipped:', file, err);
        return [];
      }));
    });

    return Promise.all(jobs).then(function (groups) {
      state.mediaList = [];
      var entries = [];
      groups.forEach(function (group) { entries = entries.concat(group); });
      (catalog.images || []).filter(function (f) { return isContentFile(f, IMAGE_EXT); }).forEach(function (f) {
        state.mediaList.push('content/media/images/' + f);
        entries.push({ id: 'img-' + hashId(f), type: 'image', src: 'content/media/images/' + f, name: f });
      });
      (catalog.videos || []).filter(function (f) { return isContentFile(f, VIDEO_EXT); }).forEach(function (f) {
        state.mediaList.push('content/media/videos/' + f);
        entries.push({ id: 'vid-' + hashId(f), type: 'video', src: 'content/media/videos/' + f, name: f, isGif: extOf(f) === '.gif' });
      });
      return entries;
    });
  }

  /** Fallback for servers without a catalog: scrape directory listings. */
  async function scrapeListing(url, exts, hrefPrefix) {
    var response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error('listing failed: ' + url + ' (' + response.status + ')');
    var html = await response.text();
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var names = [];
    doc.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var name = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
      if (isContentFile(name, exts)) names.push(name);
    });
    return names.map(function (name) { return hrefPrefix + name; });
  }

  async function buildFromListings() {
    var msgUrls = await scrapeListing('content/messages/', TEXT_EXT, 'content/messages/').catch(function () { return []; });
    var jobs = msgUrls.map(function (url) {
      return fetchText(url).then(function (text) {
        var parsed = window.SagingParser.parseMessages(text);
        var file = url.split('/').pop();
        return parsed.messages.map(function (m) {
          return { id: 'msg-' + hashId(file + '#' + m.id + m.text), type: 'message', text: m.text };
        });
      }).catch(function (err) {
        console.warn('[HAPPY BIRTHDAY PO!] message file skipped:', url, err);
        return [];
      });
    });
    var results = await Promise.all([
      Promise.all(jobs),
      scrapeListing('content/media/images/', IMAGE_EXT, 'content/media/images/').catch(function () { return []; }),
      scrapeListing('content/media/videos/', VIDEO_EXT, 'content/media/videos/').catch(function () { return []; })
    ]);
    var entries = [];
    results[0].forEach(function (group) { entries = entries.concat(group); });
    state.mediaList = [];
    results[1].forEach(function (src) {
      state.mediaList.push(src);
      entries.push({ id: 'img-' + hashId(src), type: 'image', src: src, name: src.split('/').pop() });
    });
    results[2].forEach(function (src) {
      state.mediaList.push(src);
      entries.push({ id: 'vid-' + hashId(src), type: 'video', src: src, name: src.split('/').pop(), isGif: extOf(src) === '.gif' });
    });
    return entries;
  }

  async function loadContent() {
    // 0) Desktop build: content embedded at build time — no network, no fetch.
    if (DESKTOP_CONTENT) {
      state.entries = []
        .concat(DESKTOP_CONTENT.messages || [])
        .concat(DESKTOP_CONTENT.images || [])
        .concat(DESKTOP_CONTENT.videos || []);
      state.mediaList = state.entries.filter(function (e) { return e.type !== 'message'; }).map(function (e) { return e.src; });
      state.contentSource = 'desktop';
      state.contentReady = true;
      reportContent();
      bootMediaPrep();
      return;
    }
    // 1) catalog.json (generated by tools/build-catalog.py)
    try {
      var catalog = await fetchJSON('content/catalog.json');
      state.entries = await entriesFromCatalog(catalog);
      state.contentSource = 'catalog';
      state.contentReady = true;
      reportContent();
      bootMediaPrep();
      return;
    } catch (err) {
      console.info('[HAPPY BIRTHDAY PO!] catalog.json unavailable — trying directory listings (' + err.message + ')');
    }
    // 2) directory-listing scrape (python -m http.server, Apache, nginx autoindex)
    try {
      state.entries = await buildFromListings();
      state.contentSource = 'listings';
      state.contentReady = true;
      reportContent();
      bootMediaPrep();
      return;
    } catch (err2) {
      console.warn('[HAPPY BIRTHDAY PO!] content discovery failed:', err2);
    }
    // 3) empty — the card will explain, never break
    state.entries = [];
    state.mediaList = [];
    state.contentSource = 'empty';
    state.contentReady = true;
    reportContent();
    bootMediaPrep();
  }

  function reportContent() {
    var counts = { message: 0, image: 0, video: 0 };
    state.entries.forEach(function (e) { counts[e.type] = (counts[e.type] || 0) + 1; });
    console.info('[HAPPY BIRTHDAY PO!] content (' + state.contentSource + '): ' +
      counts.message + ' messages · ' + counts.image + ' pictures · ' + counts.video + ' videos');
  }

  /* ---------------- current video lifecycle ---------------- */
  function stopVideo() {
    if (!currentVideo) return;
    try {
      currentVideo.pause();
      currentVideo.removeAttribute('src');
      currentVideo.load();
    } catch (e) { /* already released */ }
    currentVideo = null;
  }

  /* ---------------- surprise overlay ---------------- */
  var overlay = $('surpriseOverlay');
  var contentNode = $('surpriseContent');
  var anotherBtn = $('anotherSurpriseBtn');
  var closeBtn = $('surpriseCloseBtn');

  function renderSurprise(entry) {
    stopVideo();
    contentNode.innerHTML = '';

    if (!entry) {
      var emptyBox = el('div', 'surprise-empty');
      if (!state.contentReady) {
        emptyBox.appendChild(el('p', 'surprise-message', 'Loading your surprises…'));
        emptyBox.appendChild(el('p', 'surprise-empty-sub', 'Just a tiny moment.'));
      } else {
        emptyBox.appendChild(el('p', 'surprise-message', 'The surprises are still being prepared with love.'));
        emptyBox.appendChild(el('p', 'surprise-empty-sub', 'Please come back soon — and in the meantime, enjoy the kamote cue.'));
      }
      contentNode.appendChild(emptyBox);
      return;
    }

    if (entry.type === 'image') {
      var img = document.createElement('img');
      img.className = 'surprise-image';
      img.src = entry.src;
      img.alt = entry.name ? 'A surprise picture: ' + entry.name : 'A surprise picture';
      img.decoding = 'async';
      img.onerror = function () {
        img.remove();
        contentNode.appendChild(el('p', 'surprise-message', 'This picture couldn\'t be shown — the file may be corrupted or in an unsupported format.'));
      };
      contentNode.appendChild(img);
      return;
    }

    if (entry.type === 'video') {
      // Animated GIFs play natively as <img>; <video> cannot decode them.
      if (entry.isGif) {
        var gif = document.createElement('img');
        gif.className = 'surprise-image';
        gif.src = entry.src;
        gif.alt = entry.name ? 'A surprise animation: ' + entry.name : 'A surprise animation';
        gif.decoding = 'async';
        gif.onerror = function () {
          gif.remove();
          contentNode.appendChild(el('p', 'surprise-message', 'This animation couldn\'t be shown — the file may be corrupted.'));
        };
        contentNode.appendChild(gif);
        return;
      }

      var video = document.createElement('video');
      video.className = 'surprise-video';
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('playsinline', '');
      video.src = entry.src;
      video.addEventListener('error', function () {
        contentNode.innerHTML = '';
        contentNode.appendChild(el('p', 'surprise-message', 'This video couldn\'t be played in this browser. An H.264 MP4 will play everywhere — including iPhone.'));
      });
      contentNode.appendChild(video);
      currentVideo = video;
      // The tap that opened this card counts as the gesture that allows playback.
      var playPromise = video.play();
      if (playPromise && playPromise.catch) playPromise.catch(function () { /* controls remain usable */ });
      return;
    }

    // message
    contentNode.appendChild(el('p', 'surprise-message', entry.text));
  }

  function openSurprise(trigger) {
    lastTrigger = trigger || $('kamoteBtn');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.inert = false;
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function closeSurprise() {
    stopVideo();
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;
    document.body.style.overflow = '';
    var target = lastTrigger || $('kamoteBtn');
    if (target && target.focus) target.focus({ preventScroll: true });
    playSound('click');
  }

  function drawAndShow(isRefresh, trigger) {
    var entry = picker.pick();
    renderSurprise(entry);
    if (!isRefresh) openSurprise(trigger);
    playSound(isRefresh ? 'click' : 'chime');
    if (navigator.vibrate) { try { navigator.vibrate(isRefresh ? 10 : 18); } catch (e) { /* unsupported */ } }
  }

  /* ---------------- kamote cue tap ---------------- */
  function celebrateAndDraw(originButton, lx, ly) {
    var btn = $('kamoteBtn');
    if (!state.mediaReady) { showPreparationNeeded(); return; }
    var rect = $('sceneCard').getBoundingClientRect();

    var x = (typeof lx === 'number') ? lx : rect.width / 2;
    var y = (typeof ly === 'number') ? ly : rect.height * 0.38;

    btn.classList.remove('is-wiggling');
    void btn.offsetWidth;
    btn.classList.add('is-wiggling');

    spawnTapRing(x, y);
    spawnSparkles(rect.width / 2, rect.height * 0.42);
    playSound('pop');
    window.setTimeout(function () { playSound('chime'); }, 120);

    drawAndShow(false, originButton);
  }

  function onKamoteTap(event) {
    var rect = $('sceneCard').getBoundingClientRect();
    var clientX = (event && typeof event.clientX === 'number') ? event.clientX : rect.left + rect.width / 2;
    var clientY = (event && typeof event.clientY === 'number') ? event.clientY : rect.top + rect.height * 0.38;
    celebrateAndDraw(event.currentTarget || $('kamoteBtn'), clientX - rect.left, clientY - rect.top);
  }

  /* ---------------- wire up ---------------- */
  function init() {
    loadContent(); // async, non-blocking; card handles the rare "not ready / empty" case

    $('kamoteBtn').addEventListener('click', onKamoteTap);
    $('tapInstruction').addEventListener('click', function () { celebrateAndDraw($('tapInstruction')); });

    closeBtn.addEventListener('click', closeSurprise);
    anotherBtn.addEventListener('click', function () { drawAndShow(true, null); });

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeSurprise();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && overlay.classList.contains('is-open')) closeSurprise();
    });

    window.setInterval(spawnAmbientHeart, 2200);

    // Ask for persistent storage so the OS keeps our cache (never assumed granted).
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(function (granted) {
        console.info('[HAPPY BIRTHDAY PO!] persistent storage:', granted ? 'granted' : 'not granted (best-effort cache still works)');
      }).catch(function () { /* storage API unavailable */ });
    }

    // offline-first: register the service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').then(function () {
          console.info('[HAPPY BIRTHDAY PO!] Service worker registered.');
        }).catch(function (error) {
          console.warn('[HAPPY BIRTHDAY PO!] Service worker registration failed:', error);
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
