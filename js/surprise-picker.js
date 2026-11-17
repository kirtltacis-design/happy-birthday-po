/* ============================================================================
   HAPPY BIRTHDAY PO! — Surprise picker (pure logic, no DOM)
   ============================================================================
   THREE surprise types share one roulette:
     message · image · video

   Behavior:
     • Type roulette weighted by window.SURPRISE_WEIGHTS (default 1/1/1).
     • A type with zero entries donates its share to the remaining types,
       proportional to their weights.
     • Exhaust-then-reset within each type (no repeats until every entry of
       that type has been shown), and the just-shown entry is skipped across
       a reset when alternatives exist.
     • A global no-immediate-repeat guarantee across all types when any
       alternative exists.
     • Malformed entries are ignored; missing types never break the roulette.
   ========================================================================== */

(function (root) {
  'use strict';

  var TYPES = ['message', 'image', 'video'];

  function clampWeight(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  function isValidEntry(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (typeof entry.id !== 'string' || entry.id.length === 0) return false;
    if (entry.type === 'message') {
      return typeof entry.text === 'string' && entry.text.trim().length > 0;
    }
    if (entry.type === 'image') {
      return typeof entry.src === 'string' && entry.src.length > 0;
    }
    if (entry.type === 'video') {
      return typeof entry.src === 'string' && entry.src.length > 0;
    }
    return false;
  }

  function createPicker(options) {
    options = options || {};
    var getEntries = typeof options.getEntries === 'function'
      ? options.getEntries
      : function () { return []; };
    var weights = options.weights || { message: 1, image: 1, video: 1 };
    var rng = typeof options.rng === 'function' ? options.rng : Math.random;

    var used = { message: [], image: [], video: [] };
    var lastId = null;

    function availableTypes(entries) {
      var present = {};
      entries.forEach(function (e) { present[e.type] = true; });
      return TYPES.filter(function (t) { return present[t]; });
    }

    /** Weighted type roulette; missing types' share redistributes proportionally. */
    function pickType(available) {
      if (available.length === 0) return null;
      var total = 0;
      available.forEach(function (t) { total += Math.max(0, clampWeight(weights[t])); });
      if (total <= 0) {
        // All weights zero — split evenly among available types.
        return available[Math.floor(rng() * available.length)];
      }
      var roll = rng() * total;
      for (var i = 0; i < available.length; i++) {
        var w = Math.max(0, clampWeight(weights[available[i]]));
        if (roll < w) return available[i];
        roll -= w;
      }
      return available[available.length - 1];
    }

    function drawFromType(type, entries) {
      var pool = entries.filter(function (e) { return e.type === type; });
      if (pool.length === 0) return null;

      var usedSet = {};
      used[type].forEach(function (id) { usedSet[id] = true; });
      var remaining = pool.filter(function (e) { return !usedSet[e.id]; });

      if (remaining.length === 0) {
        // Type exhausted — reset its bag, skipping the just-shown entry if possible.
        used[type] = [];
        remaining = pool.slice();
        if (pool.length > 1 && lastId) {
          var filtered = remaining.filter(function (e) { return e.id !== lastId; });
          if (filtered.length > 0) remaining = filtered;
        }
      }

      var index = Math.floor(rng() * remaining.length);
      if (index >= remaining.length) index = remaining.length - 1;
      var picked = remaining[index];
      used[type].push(picked.id);
      lastId = picked.id;
      return picked;
    }

    /** Announce the type the next pick() would choose, without consuming it. */
    function chooseType() {
      var entries = getEntries().filter(isValidEntry);
      var available = availableTypes(entries);
      return pickType(available);
    }

    /** Draw one surprise. Returns the entry, or null when the pool is empty.
        Optionally forces the type (used for pre-armed video candidates). */
    function pick(forcedType) {
      var entries = getEntries().filter(isValidEntry);
      if (entries.length === 0) return null;

      var available = availableTypes(entries);
      if (available.length === 0) return null;

      var type = (typeof forcedType === 'string' && TYPES.indexOf(forcedType) !== -1) ? forcedType : pickType(available);
      if (!type) return null;

      var previousLast = lastId;
      var picked = drawFromType(type, entries);
      if (!picked) {
        if (typeof forcedType === 'string') {
          // Forced type came up empty — fall back to the normal roulette.
          var fallbackType = pickType(available);
          picked = fallbackType ? drawFromType(fallbackType, entries) : null;
        }
        if (!picked) return null;
      }

      // Global no-immediate-repeat across ALL types (belt & braces).
      if (previousLast !== null && picked.id === previousLast && entries.length > 1) {
        var alternatives = entries.filter(function (e) { return e.id !== previousLast; });
        if (alternatives.length > 0) {
          var idx = Math.floor(rng() * alternatives.length);
          if (idx >= alternatives.length) idx = alternatives.length - 1;
          picked = alternatives[idx];
          var t = picked.type;
          used[t] = used[t].filter(function (id) { return id !== picked.id; });
          used[t].push(picked.id);
          lastId = picked.id;
        }
      }
      return picked;
    }

    function reset() {
      used = { message: [], image: [], video: [] };
      lastId = null;
    }

    return { pick: pick, chooseType: chooseType, reset: reset };
  }

  var api = { createPicker: createPicker, isValidEntry: isValidEntry, TYPES: TYPES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SagingPicker = api;
  }
})(typeof window !== 'undefined' ? window : this);
