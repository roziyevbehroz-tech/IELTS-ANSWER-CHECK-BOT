/* CD test — offline inglizcha izohli lug'at (WordNet).
 * Ma'lumot window.__CD_DICT_B64 da gzip+base64 — faqat BIRINCHI qidiruvda
 * (native DecompressionStream orqali) ochiladi, shuning uchun fayl tez yuklanadi.
 * CDDict.lookup(word) -> Promise<{word, defs:[[pos,def],...]} | null>
 */
(function () {
  "use strict";
  var DICT = null;      // { d: {word:[[pos,def]..]}, e: {infl:base} }
  var loading = null;

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var n = bin.length;
    var bytes = new Uint8Array(n);
    for (var i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function init() {
    if (DICT) return Promise.resolve(DICT);
    if (loading) return loading;
    var b64 = window.__CD_DICT_B64;
    if (!b64) return Promise.resolve(null);
    loading = (function () {
      try {
        if (typeof DecompressionStream === "undefined" || typeof Response === "undefined") {
          return Promise.resolve(null);
        }
        var bytes = b64ToBytes(b64);
        var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        return new Response(stream).text().then(function (text) {
          DICT = JSON.parse(text);
          return DICT;
        }).catch(function () { return null; });
      } catch (e) { return Promise.resolve(null); }
    })();
    return loading;
  }

  function norm(w) {
    return (w || "").toString().toLowerCase().trim().replace(/^[^a-z]+|[^a-z]+$/g, "");
  }

  // morphy-uslubidagi qo'shimcha yechish qoidalari
  var RULES = {
    n: [["s", ""], ["ses", "s"], ["xes", "x"], ["zes", "z"], ["ches", "ch"], ["shes", "sh"], ["men", "man"], ["ies", "y"]],
    v: [["s", ""], ["ies", "y"], ["es", "e"], ["es", ""], ["ed", "e"], ["ed", ""], ["ing", "e"], ["ing", ""]],
    a: [["er", ""], ["est", ""], ["er", "e"], ["est", "e"]]
  };

  function candidates(w) {
    var out = [w];
    if (DICT.e[w]) out.push(DICT.e[w]);
    ["n", "v", "a"].forEach(function (pos) {
      RULES[pos].forEach(function (r) {
        var suf = r[0], rep = r[1];
        if (w.length > suf.length + 1 && w.slice(-suf.length) === suf) {
          out.push(w.slice(0, w.length - suf.length) + rep);
        }
      });
    });
    // Ikkilangan undosh (running->run, travelled->travel, stopped->stop)
    var extra = [];
    out.forEach(function (c) {
      var L = c.length;
      if (L > 2 && c[L - 1] === c[L - 2] && "bcdfghjklmnpqrstvwxz".indexOf(c[L - 1]) !== -1) {
        extra.push(c.slice(0, -1));
      }
    });
    return out.concat(extra);
  }

  function lookupSync(word) {
    if (!DICT) return null;
    var w = norm(word);
    if (!w) return null;
    var cands = candidates(w);
    for (var i = 0; i < cands.length; i++) {
      var defs = DICT.d[cands[i]];
      if (defs && defs.length) return { word: cands[i], defs: defs };
    }
    return null;
  }

  window.CDDict = {
    ready: init,
    lookup: function (word) { return init().then(function () { return lookupSync(word); }); }
  };
})();
