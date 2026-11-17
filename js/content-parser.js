/* ============================================================================
   HAPPY BIRTHDAY PO! — Message file parser (pure logic, no DOM)
   ============================================================================
   Reads the Owner's .txt message collection and turns it into surprise entries.
   Never invents, rewrites or paraphrases messages. Never drops non-empty
   messages silently.

   Supported formats (auto-detected):
     A) Paragraph mode — messages separated by blank lines (internal line
        breaks are preserved).
     B) Line mode      — one message per line; leading ordinals and bullets
        are stripped ("1. ", "2) ", "- ", "* ", "• ", "– ").

   Encoding: UTF-8 (a leading BOM is stripped). CRLF/CR/LF all accepted.
   ========================================================================== */

(function (root) {
  'use strict';

  var ORDINAL = /^\s*(?:\d{1,4}\s*[.)\]:\-–—]|\d{1,4}\s+(?=\S)|[-*•–—·▪]{1,2})\s*/;

  function stripBOM(text) {
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  }
  function normalizeNewlines(text) {
    return text.replace(/\r\n?/g, '\n');
  }

  function isSeparatorLine(line) {
    return /^\s*$/.test(line);
  }

  /** Paragraph mode: split on one or more blank lines. */
  function splitParagraphs(text) {
    var blocks = text.split(/\n[ \t]*\n+/);
    return blocks.map(function (block) {
      return block.split('\n').map(function (line) { return line.replace(/[ \t]+$/g, ''); })
        .join('\n')
        .replace(/^\n+/, '')
        .replace(/\n+$/g, '');
    }).filter(function (block) { return block.trim().length > 0; });
  }

  /** Line mode: one message per line, ordinal/bullet stripped. */
  function splitLines(text) {
    var messages = [];
    var stripped = 0;
    text.split('\n').forEach(function (raw) {
      var line = raw.replace(/[ \t]+$/g, '');
      var trimmed = line.trim();
      if (trimmed.length === 0) return;
      var hadMarker = ORDINAL.test(trimmed);
      var cleaned = trimmed.replace(ORDINAL, '').trim();
      if (cleaned.length === 0) return; // a lone bullet line is not a message
      if (hadMarker) stripped += 1;
      messages.push(cleaned);
    });
    return { messages: messages, strippedMarkers: stripped };
  }

  /** djb2 hash → short stable id for a message's content. */
  function hash(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i++) {
      h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  }

  /**
   * Mode detection: an INTERIOR blank line — a blank line with real content
   * on BOTH sides — means paragraph mode. Leading/trailing blanks are ignored.
   */
  function hasInteriorBlankLine(lines) {
    var contentBefore = [false], i;
    var seen = false;
    for (i = 0; i < lines.length; i++) {
      if (!isSeparatorLine(lines[i])) seen = true;
      contentBefore[i] = seen;
    }
    var seenAfter = false;
    for (i = lines.length - 1; i >= 0; i--) {
      if (isSeparatorLine(lines[i]) && contentBefore[i] && seenAfter) return true;
      if (!isSeparatorLine(lines[i])) seenAfter = true;
    }
    return false;
  }

  /**
   * Parse a message file.
   * @param {string} text  Raw file contents.
   * @returns {{ messages: Array<{id:string, text:string}>,
   *            stats: { paragraphMode: boolean, strippedMarkers: number,
   *                     lineCount: number, blankLineCount: number } }}
   */
  function parseMessages(text) {
    var src = normalizeNewlines(stripBOM(String(text == null ? '' : text)));
    // ignore leading/trailing blank lines for mode detection and splitting
    var lines = src.split('\n');
    var blankLines = lines.filter(isSeparatorLine).length;
    var paragraphMode = hasInteriorBlankLine(lines);

    var messages, strippedMarkers = 0;
    if (paragraphMode) {
      messages = splitParagraphs(src);
    } else {
      var result = splitLines(src);
      messages = result.messages;
      strippedMarkers = result.strippedMarkers;
    }

    return {
      messages: messages.map(function (text) {
        var clean = text.trim();
        return { id: 'msg-' + hash(clean), text: clean };
      }),
      stats: {
        paragraphMode: paragraphMode,
        strippedMarkers: strippedMarkers,
        lineCount: lines.length,
        blankLineCount: blankLines
      }
    };
  }

  var api = { parseMessages: parseMessages, hash: hash };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SagingParser = api;
  }
})(typeof window !== 'undefined' ? window : this);
