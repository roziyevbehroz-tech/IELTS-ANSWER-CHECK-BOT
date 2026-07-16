/* CD Reading test — generic engine (ma'lumotga asoslangan).
 * window.CD_DATA renderer tomonidan to'ldiriladi:
 *   { answers:{q:ans|[..]}, groups:[{kind,start,end}], parts:[[s,e]..],
 *     settings:{duration} }
 * Mantiq: «Deliver» -> to'g'ri javoblar qulflanadi (yashil), xatolar tahrirlanadi.
 * Cheksiz qayta urinish. Xato javoblarning to'g'ri varianti «ko'rish»da ochiladi.
 */
(function () {
  "use strict";
  var D = window.CD_DATA || { answers: {}, groups: [], parts: [], settings: {} };
  var S = D.settings || {};
  var totalQuestions = Object.keys(D.answers).length;
  var partCount = (D.parts || []).length || 1;
  var currentPart = 1;
  var timeLeft = (S.duration || 60) * 60;
  var timerId = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    setupTimer();
    setupResizer();
    setupParts();
    setupEditor();
    setupHighlight();
    switchToPart(1);
    var db = document.getElementById("deliver-button");
    if (db) db.addEventListener("click", onDeliver);
    var rv = document.getElementById("reveal-button");
    if (rv) rv.addEventListener("click", revealAll);
    var cl = document.getElementById("modal-close");
    if (cl) cl.addEventListener("click", function () {
      document.getElementById("results-modal").classList.add("hidden");
    });
    // Yakka javob ko'z ikonkasi (event delegation — qatorlar qayta chiziladi)
    var rd = document.getElementById("results-details");
    if (rd) rd.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".row-eye") : null;
      if (!btn) return;
      var q = btn.getAttribute("data-q");
      rowSeen[q] = !rowSeen[q];
      renderRows();
    });
  }

  // ------------------------------ timer ------------------------------
  function setupTimer() {
    render(); tick();
    var t = document.getElementById("timer-toggle-btn");
    var r = document.getElementById("timer-reset-btn");
    if (t) t.addEventListener("click", toggle);
    if (r) r.addEventListener("click", function () { timeLeft = (S.duration || 60) * 60; render(); if (!timerId) toggle(); });
    function tick() { timerId = setInterval(function () {
      if (timeLeft > 0) { timeLeft--; render(); }
      else { clearInterval(timerId); timerId = null; onTimeUp(); }
    }, 1000); }
    function onTimeUp() {
      // Vaqt tugadi — faqat eslatma; o'quvchi ishlashda davom etaveradi
      var el = document.querySelector(".timer-display");
      if (el) { el.textContent = "00:00"; el.classList.add("time-up"); }
    }
    function toggle() {
      if (timerId) { clearInterval(timerId); timerId = null; setIcon(true); }
      else { tick(); setIcon(false); }
    }
    function setIcon(paused) {
      var b = document.getElementById("timer-toggle-btn"); if (!b) return;
      b.innerHTML = paused
        ? '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M8 5v14l11-7z"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>';
    }
    function render() {
      var m = Math.floor(timeLeft / 60), s = timeLeft % 60;
      var el = document.querySelector(".timer-display");
      if (el) el.textContent = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }
  }

  // ----------------------------- resizer -----------------------------
  function setupResizer() {
    var rez = document.getElementById("resizer");
    var left = document.getElementById("passage-panel");
    var right = document.getElementById("questions-panel");
    if (!rez || !left || !right) return;
    var dragging = false;
    rez.addEventListener("mousedown", function () { dragging = true; document.body.style.userSelect = "none"; });
    window.addEventListener("mouseup", function () { dragging = false; document.body.style.userSelect = ""; });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var c = document.querySelector(".panels-container");
      var rect = c.getBoundingClientRect();
      var pct = ((e.clientX - rect.left) / rect.width) * 100;
      pct = Math.max(25, Math.min(75, pct));
      left.style.flex = "0 0 " + pct + "%";
      right.style.flex = "0 0 " + (100 - pct) + "%";
    });
  }

  // -------------------------- parts / nav ----------------------------
  var qList = Object.keys(D.answers).map(Number).sort(function (a, b) { return a - b; });
  var currentQuestion = qList.length ? qList[0] : 1;

  function setupParts() {
    var prev = document.getElementById("prevBtn");
    var next = document.getElementById("nextBtn");
    // Strelkalar: bitta savol oldinga/orqaga (IDP kabi)
    if (prev) prev.addEventListener("click", function () { stepQuestion(-1); });
    if (next) next.addEventListener("click", function () { stepQuestion(1); });
    buildBottomNav();
    // Savolga javob kiritilganda pastki panel yangilanadi
    var qp = document.getElementById("questions-panel");
    if (qp) {
      qp.addEventListener("input", refreshBottomNav);
      qp.addEventListener("change", refreshBottomNav);
    }
  }

  function partRange(p) { return (D.parts && D.parts[p - 1]) || [qList[0] || 1, qList[qList.length - 1] || 1]; }
  function partOf(q) {
    for (var i = 1; i <= partCount; i++) {
      var r = partRange(i);
      if (r[0] && q >= r[0] && q <= r[1]) return i;
    }
    var g = groupOf(q);
    if (g) { for (var j = 0; j < D.groups.length; j++) if (D.groups[j] === g) { /* noop */ } }
    return currentPart;
  }
  function qEl(q) {
    var e = document.getElementById("q" + q);
    if (e) return e;
    var r = document.querySelector('input[name="q' + q + '"]');
    if (r) return r;
    var g = groupOf(q);
    if (g && g.kind === "mcq_multi") return document.querySelector('input[name="qm' + g.start + '"]');
    return null;
  }
  function isAnswered(q) {
    var g = groupOf(q);
    if (g && (g.kind === "tfng" || g.kind === "ynng" || g.kind === "mcq")) {
      return !!document.querySelector('input[name="q' + q + '"]:checked');
    }
    if (g && g.kind === "mcq_multi") {
      var n = document.querySelectorAll('input[name="qm' + g.start + '"]:checked').length;
      return n >= (q - g.start + 1);
    }
    var e = document.getElementById("q" + q);
    return !!(e && String(e.value || "").trim());
  }

  // Pastki ixcham part navigatsiyasi (IDP uslubi)
  function buildBottomNav() {
    var host = document.getElementById("bn-parts");
    if (!host) return;
    host.innerHTML = "";
    for (var i = 1; i <= partCount; i++) {
      var r = partRange(i);
      var sec = document.createElement("div");
      sec.className = "bn-part" + (i === currentPart ? " active" : "");
      sec.setAttribute("data-part", i);
      var lbl = document.createElement("button");
      lbl.className = "bn-label";
      lbl.textContent = "Part " + i;
      (function (pi) { lbl.addEventListener("click", function () { switchToPart(pi); }); })(i);
      sec.appendChild(lbl);
      if (i === currentPart && r[0]) {
        var chips = document.createElement("div");
        chips.className = "bn-chips";
        for (var q = r[0]; q <= r[1]; q++) {
          var b = document.createElement("button");
          b.className = "bn-q";
          b.setAttribute("data-q", q);
          b.textContent = q;
          (function (qq) { b.addEventListener("click", function () { gotoQuestion(qq); }); })(q);
          chips.appendChild(b);
        }
        sec.appendChild(chips);
      } else if (r[0]) {
        var cnt = document.createElement("span");
        cnt.className = "bn-count";
        sec.appendChild(cnt);
      }
      host.appendChild(sec);
    }
    refreshBottomNav();
  }
  function refreshBottomNav() {
    for (var i = 1; i <= partCount; i++) {
      var r = partRange(i);
      var done = 0, tot = 0;
      if (r[0]) for (var q = r[0]; q <= r[1]; q++) { tot++; if (isAnswered(q)) done++; }
      var sec = document.querySelector('.bn-part[data-part="' + i + '"]');
      if (!sec) continue;
      var cnt = sec.querySelector(".bn-count");
      if (cnt) cnt.textContent = done + " / " + tot;
    }
    document.querySelectorAll(".bn-q").forEach(function (b) {
      var q = parseInt(b.getAttribute("data-q"), 10);
      b.classList.toggle("answered", isAnswered(q));
      b.classList.toggle("current", q === currentQuestion);
    });
  }

  function gotoQuestion(q) {
    var p = partOf(q);
    if (p !== currentPart) switchToPart(p, true);
    currentQuestion = q;
    var el = qEl(q);
    if (el) {
      var wrap = (el.closest && (el.closest(".statement") || el.closest(".matching-form-row") || el.closest(".question"))) || el;
      document.querySelectorAll(".q-active").forEach(function (x) { x.classList.remove("q-active"); });
      if (wrap.classList) wrap.classList.add("q-active");
      if (el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    refreshBottomNav();
  }
  function stepQuestion(dir) {
    var idx = qList.indexOf(currentQuestion);
    if (idx === -1) idx = 0;
    var ni = idx + dir;
    if (ni < 0 || ni >= qList.length) return;
    gotoQuestion(qList[ni]);
  }

  function switchToPart(p, keepQuestion) {
    currentPart = p;
    for (var i = 1; i <= partCount; i++) {
      toggle("passage-text-" + i, i === p);
      toggle("questions-" + i, i === p);
      toggle("part-header-" + i, i === p);
    }
    document.querySelectorAll(".bn-part").forEach(function (t) {
      t.classList.toggle("active", parseInt(t.dataset.part, 10) === p);
    });
    var pb = document.getElementById("prevBtn"), nb = document.getElementById("nextBtn");
    if (pb) pb.disabled = qList.indexOf(currentQuestion) <= 0;
    if (nb) nb.disabled = qList.indexOf(currentQuestion) >= qList.length - 1;
    if (!keepQuestion) {
      var r = partRange(p);
      if (r[0]) currentQuestion = r[0];
    }
    var pp = document.getElementById("passage-panel"); if (pp) pp.scrollTop = 0;
    var qp = document.getElementById("questions-panel"); if (qp) qp.scrollTop = 0;
    buildBottomNav();
  }
  function toggle(id, show) { var e = document.getElementById(id); if (e) e.classList.toggle("hidden", !show); }

  // ---------------------------- highlight ----------------------------
  function setupHighlight() {
    // Passage VA savollar paneli — ikkalasida ham highlight ishlaydi
    var root = document.querySelector(".panels-container") || document.getElementById("main-container");
    var pop = document.getElementById("hl-popup");
    if (!root || !pop) return;
    // Mavjud highlight ustiga bosib olib tashlash
    root.addEventListener("click", function (e) {
      var m = e.target.closest ? e.target.closest(".cd-hl") : null;
      if (m && !document.body.classList.contains("cd-editing")) unwrapMark(m);
    });
    root.addEventListener("mouseup", function () {
      if (document.body.classList.contains("cd-editing")) return;
      setTimeout(function () {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) { pop.classList.add("hidden"); return; }
        var range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) { pop.classList.add("hidden"); return; }
        // Tanlov highlight ustida bo'lsa — tugma "olib tashlash" rejimida
        pop.textContent = marksInRange(range).length ? "🚫 Olib tashlash" : "🖍 Highlight";
        var rect = range.getBoundingClientRect();
        pop.style.top = (window.scrollY + rect.top - 42) + "px";
        pop.style.left = (window.scrollX + rect.left + rect.width / 2 - 55) + "px";
        pop.classList.remove("hidden");
      }, 10);
    });
    pop.addEventListener("mousedown", function (e) { e.preventDefault(); });
    pop.addEventListener("click", function () {
      highlightSelection();
      pop.classList.add("hidden");
    });
    document.addEventListener("mousedown", function (e) {
      if (!pop.contains(e.target)) pop.classList.add("hidden");
    });
  }
  function unwrapMark(m) {
    var par = m.parentNode;
    while (m.firstChild) par.insertBefore(m.firstChild, m);
    par.removeChild(m);
    if (par.normalize) par.normalize();
  }
  function marksInRange(range) {
    var out = [];
    // Tanlov to'liq highlight ichida bo'lsa — o'sha markni topamiz
    var anc = range.commonAncestorContainer;
    var node = anc.nodeType === 1 ? anc : anc.parentNode;
    var up = node && node.closest ? node.closest(".cd-hl") : null;
    if (up) out.push(up);
    // Tanlov ichidagi (ustidagi) highlightlar
    var rootEl = anc.nodeType === 1 ? anc : anc.parentNode;
    if (rootEl && rootEl.querySelectorAll) {
      rootEl.querySelectorAll(".cd-hl").forEach(function (m) {
        try { if (range.intersectsNode(m) && out.indexOf(m) === -1) out.push(m); } catch (e) {}
      });
    }
    return out;
  }
  function highlightSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    if (range.collapsed) return;
    // Toggle: tanlov highlight ustida bo'lsa — olib tashlaymiz
    var existing = marksInRange(range);
    if (existing.length) {
      existing.forEach(unwrapMark);
      sel.removeAllRanges();
      return;
    }
    var mark = document.createElement("span");
    mark.className = "cd-hl";
    try { range.surroundContents(mark); }
    catch (e) { mark.appendChild(range.extractContents()); range.insertNode(mark); }
    sel.removeAllRanges();
  }

  // ---------------------------- checking -----------------------------
  // Cheksiz qayta urinish: to'g'ri javoblar qulflanadi (yashil), xato/bo'shlar
  // tahrirlanadigan qoladi. Foydalanuvchi oynani yopib, xatolarni qayta kiritib
  // yana «Deliver» bosishi mumkin — cheksiz. To'g'ri javoblar HAR DOIM darrov
  // belgilanadi; xatolarning to'g'ri varianti «Javoblarni ko'rish»da ochiladi.
  var revealed = false;
  var locked = {};
  var rowSeen = {};   // natija oynasida yakka ochilgan xato javoblar

  function norm(s) {
    // Punktuatsiyani BO'SHLIQQA aylantiramiz (defis/sana shakllari mos kelsin:
    // "1-May" == "1 May", "(the) book" -> yoyilgan variantlar bilan).
    return (s || "").toString().toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function textCorrect(user, key) {
    var u = norm(user);
    if (!u) return false;
    var alts = Array.isArray(key) ? key : String(key).split("/");
    return alts.some(function (a) { return norm(a) === u; });
  }
  var ROMAN = { i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8, ix:9, x:10,
                xi:11, xii:12, xiii:13, xiv:14, xv:15, xvi:16, xvii:17, xviii:18,
                xix:19, xx:20 };
  function numeralVal(s) {
    // Rim raqami (i, ii, iii…) yoki oddiy raqam (1, 2, 3…) -> butun son.
    // Boshqa hollarda null (harflar A–H, TRUE va h.k. ta'sirlanmaydi).
    var t = (s || "").toString().trim().toLowerCase().replace(/[).\s]+$/g, "");
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    if (ROMAN.hasOwnProperty(t)) return ROMAN[t];
    return null;
  }
  function letterCorrect(user, key) {
    var u = (user || "").toString().trim().toUpperCase();
    if (!u) return false;
    var alts = Array.isArray(key) ? key : String(key).split("/");
    var uv = numeralVal(user);
    return alts.some(function (a) {
      a = String(a).trim();
      if (u === a.toUpperCase()) return true;
      // Matching headings: rim raqami <-> oddiy raqam ekvivalent
      // (masalan kalit "6" bo'lsa, "vi" tanlansa ham to'g'ri).
      var av = numeralVal(a);
      return uv !== null && av !== null && uv === av;
    });
  }

  function groupOf(q) {
    for (var i = 0; i < D.groups.length; i++) {
      if (q >= D.groups[i].start && q <= D.groups[i].end) return D.groups[i];
    }
    return null;
  }

  function onDeliver() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    document.body.classList.add("results-mode");
    rowSeen = {};   // har Deliver'da yakka-ochilganlar qaytadan yashiriladi
    // Eski xato belgilarini tozalaymiz (to'g'ri/qulflangan belgilar qoladi)
    document.querySelectorAll(".incorrect").forEach(function (e) { e.classList.remove("incorrect"); });
    document.querySelectorAll(".correct-answer-display").forEach(function (e) { e.remove(); });

    var score = 0, rows = [], multiDone = {};
    var nums = Object.keys(D.answers).map(Number).sort(function (a, b) { return a - b; });
    nums.forEach(function (q) {
      var g = groupOf(q);
      var kind = g ? g.kind : "gap";
      var key = D.answers[q];
      if (kind === "mcq_multi") {
        if (multiDone[g.start]) return;
        multiDone[g.start] = true;
        var mres = checkMulti(g);
        score += mres.score;
        rows = rows.concat(mres.rows);
        return;
      }
      var res = checkSingle(q, kind, key);
      if (res.correct) score++;
      rows.push(res.row);
    });

    showResults(score, rows);
  }

  function checkSingle(q, kind, key) {
    var user = "", correct = false, mark;
    if (kind === "tfng" || kind === "ynng" || kind === "mcq") {
      var checked = document.querySelector('input[name="q' + q + '"]:checked');
      user = checked ? checked.value : "";
      correct = letterCorrect(user, key);
      var group = document.querySelector('[data-qgroup="q' + q + '"]');
      if (group) {
        group.querySelectorAll("label").forEach(function (lb) {
          var inp = lb.querySelector("input");
          if (!inp) return;
          if (inp.value === user && !correct) lb.classList.add("incorrect");
          if (correct && inp.value === user) lb.classList.add("correct");
          if (letterCorrect(inp.value, key) && revealed) lb.classList.add("correct");
        });
        // to'g'ri bo'lsa — shu savol radiolarini qulflaymiz
        if (correct) group.querySelectorAll("input").forEach(function (i) { i.disabled = true; });
      }
    } else if (kind === "matching") {
      var sel = document.getElementById("q" + q);
      user = sel ? sel.value : "";
      correct = letterCorrect(user, key);
      mark = (sel && sel.closest(".matching-form-row")) || sel;
      if (mark) mark.classList.add(correct ? "correct" : "incorrect");
      if (sel) sel.disabled = correct;             // to'g'ri -> qulf, xato -> ochiq
    } else { // gap
      var inp2 = document.getElementById("q" + q);
      user = inp2 ? inp2.value.trim() : "";
      correct = textCorrect(user, key);
      if (inp2) {
        inp2.classList.add(correct ? "correct" : "incorrect");
        inp2.disabled = correct;                   // to'g'ri -> qulf, xato -> ochiq
        if (!correct && revealed) showInline(inp2, key);
      }
    }
    if (correct) locked[q] = true;
    return { correct: correct, row: rowData(q, user, key, correct) };
  }

  function checkMulti(g) {
    var boxes = document.querySelectorAll('input[name="qm' + g.start + '"]');
    var chosen = [];
    boxes.forEach(function (b) { if (b.checked) chosen.push(b.value.toUpperCase()); });
    var expected = [];
    for (var q = g.start; q <= g.end; q++) expected.push(String(D.answers[q]).toUpperCase());
    var exp = expected.slice(), got = 0;
    chosen.forEach(function (c) {
      var idx = exp.indexOf(c);
      if (idx !== -1) { got++; exp.splice(idx, 1); }
    });
    var allCorrect = (got === expected.length && chosen.length === expected.length);
    boxes.forEach(function (b) {
      var lb = b.closest(".multi-choice-option");
      var val = b.value.toUpperCase();
      if (lb) {
        if (b.checked && expected.indexOf(val) !== -1) lb.classList.add("correct");
        else if (b.checked) lb.classList.add("incorrect");
        else if (expected.indexOf(val) !== -1 && revealed) lb.classList.add("correct");
      }
      if (allCorrect) b.disabled = true;           // to'liq to'g'ri -> qulf
    });
    var rows = [], label = expected.join(", ");
    var chosenLabel = chosen.length ? chosen.join(", ") : "Not Answered";
    for (var i = 0; i < expected.length; i++) {
      rows.push(rowData(g.start + i, i === 0 ? chosenLabel : "", label, i < got));
    }
    return { score: got, rows: rows };
  }

  function rowData(q, user, key, correct) {
    return { q: q, user: user || "Not Answered", key: Array.isArray(key) ? key.join(" / ") : key, correct: correct };
  }

  function showInline(inputEl, key) {
    if (inputEl.parentNode.querySelector(".correct-answer-display")) return;
    var span = document.createElement("span");
    span.className = "correct-answer-display";
    var k = Array.isArray(key) ? key.join(" / ") : key;
    span.innerHTML = "&nbsp;➜&nbsp;<span class='correct-answer-highlight'>" + esc(k) + "</span>";
    inputEl.parentNode.insertBefore(span, inputEl.nextSibling);
  }

  // ---------------------------- results ------------------------------
  var lastRows = [];
  function showResults(score, rows) {
    lastRows = rows;
    document.getElementById("results-score").textContent = score;
    var band = document.getElementById("results-band");
    if (band) band.textContent = bandScore(score, totalQuestions);
    var wrong = rows.filter(function (r) { return !r.correct; }).length;
    var hint = document.getElementById("results-hint");
    if (hint) {
      hint.innerHTML = wrong === 0
        ? "🎉 Barakalla! Hammasi to'g'ri."
        : "✅ To'g'ri javoblar qulflandi. <b>Yopish</b> tugmasini bosib, "
          + "qolgan <b>" + wrong + " ta</b> xato javobni tuzatib, yana <b>Deliver</b> bosing. "
          + "Yoki to'g'ri javoblarni ko'rish uchun quyidagi tugmani bosing.";
    }
    renderRows();
    var rv = document.getElementById("reveal-button");
    if (rv) rv.style.display = (revealed || wrong === 0) ? "none" : "";
    document.getElementById("results-modal").classList.remove("hidden");
  }

  function renderRows() {
    var box = document.getElementById("results-details");
    box.innerHTML = "";
    lastRows.forEach(function (r) {
      var div = document.createElement("div");
      div.className = "result-row " + (r.correct ? "correct" : "incorrect");
      // To'g'ri javob: darrov ko'rinadi. Xato: umumiy «ko'rish» yoki
      // yondagi 👁 ikonkasi bilan yakka ochilmaguncha yashirin.
      var seen = r.correct || revealed || rowSeen[r.q];
      var keyHtml = seen
        ? "<span class='correct-answer-highlight'>" + esc(r.key) + "</span>"
        : "<span class='muted'>•••</span>";
      // Xato javoblarga yakka ochish/yashirish ko'z ikonkasi
      var eye = "";
      if (!r.correct && !revealed) {
        eye = "<button type='button' class='row-eye' data-q='" + r.q +
              "' title='Javobni koʻrish/yashirish' aria-label='toggle'>" +
              (rowSeen[r.q] ? "🙈" : "👁") + "</button>";
      }
      div.innerHTML =
        "<div class='q-num'>" + r.q + "</div>" +
        "<div class='user-ans'>" + (r.correct ? "✅ " : "❌ ") + esc(r.user) + "</div>" +
        "<div class='correct-ans'>" + keyHtml + eye + "</div>";
      box.appendChild(div);
    });
  }

  function revealAll() {
    revealed = true;
    Object.keys(D.answers).map(Number).forEach(function (q) {
      var g = groupOf(q), kind = g ? g.kind : "gap", key = D.answers[q];
      if (locked[q]) return;
      if (kind === "gap") {
        var inp = document.getElementById("q" + q);
        if (inp && inp.classList.contains("incorrect")) showInline(inp, key);
      } else if (kind === "tfng" || kind === "ynng" || kind === "mcq") {
        var grp = document.querySelector('[data-qgroup="q' + q + '"]');
        if (grp) grp.querySelectorAll("label").forEach(function (lb) {
          var inp = lb.querySelector("input");
          if (inp && letterCorrect(inp.value, key)) lb.classList.add("correct");
        });
      }
    });
    renderRows();
    var rv = document.getElementById("reveal-button");
    if (rv) rv.style.display = "none";
  }

  function bandScore(score, total) {
    // 40-savolli standart IELTS Academic Reading jadvali
    var map40 = { 39: 9, 37: 8.5, 35: 8, 33: 7.5, 30: 7, 27: 6.5, 23: 6, 19: 5.5, 15: 5, 13: 4.5, 10: 4, 8: 3.5, 6: 3, 4: 2.5 };
    var s = score;
    if (total !== 40 && total > 0) s = Math.round(score / total * 40);
    var keys = Object.keys(map40).map(Number).sort(function (a, b) { return b - a; });
    for (var i = 0; i < keys.length; i++) if (s >= keys[i]) return map40[keys[i]].toFixed(1);
    return "0.0";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ------------------------------ editor ------------------------------
  // Yaratuvchi HTML'ni to'g'ridan-to'g'ri tahrirlaydi: passage/savol matnlari,
  // bold/kursiv/markaz/o'lcham. So'ng «Saqlash» — toza yakuniy faylni yuklaydi.
  var EDIT_SEL = ".reading-passage, .question-prompt, .notes-content, .summary-text, " +
    ".tf-question-text, .matching-form-label, .heading-bank, .part-header";

  function setupEditor() {
    var toggle = document.getElementById("cd-edit-toggle");
    var toolbar = document.getElementById("cd-toolbar");
    if (!toggle || !toolbar) return;
    var editing = false;

    toggle.addEventListener("click", function () { editing ? exitEdit() : enterEdit(); });
    var exitBtn = document.getElementById("cd-exit");
    var saveBtn = document.getElementById("cd-save");
    if (exitBtn) exitBtn.addEventListener("click", exitEdit);
    if (saveBtn) saveBtn.addEventListener("click", saveClean);

    toolbar.querySelectorAll("[data-cmd]").forEach(function (b) {
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });
      b.addEventListener("click", function (e) {
        e.preventDefault();
        try { document.execCommand(b.getAttribute("data-cmd"), false, null); } catch (err) {}
      });
    });
    toolbar.querySelectorAll("[data-size]").forEach(function (b) {
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });
      b.addEventListener("click", function (e) { e.preventDefault(); changeSize(b.getAttribute("data-size")); });
    });

    function enterEdit() {
      editing = true;
      document.body.classList.add("cd-editing");
      document.querySelectorAll(EDIT_SEL).forEach(function (el) { el.setAttribute("contenteditable", "true"); });
      // Form elementlarini "atomik" qilamiz (ichi tahrirlanmasin)
      document.querySelectorAll("input, select, textarea, button").forEach(function (el) {
        if (el.closest(".cd-toolbar") || el.id === "cd-edit-toggle") return;
        el.setAttribute("contenteditable", "false");
      });
      toolbar.classList.remove("hidden");
      toggle.textContent = "✅";
    }
    function exitEdit() {
      editing = false;
      document.body.classList.remove("cd-editing");
      document.querySelectorAll('[contenteditable="true"]').forEach(function (el) {
        if (el.closest(".cd-toolbar")) return;
        el.setAttribute("contenteditable", "false");
      });
      toolbar.classList.add("hidden");
      toggle.textContent = "✏️";
    }
    function changeSize(dir) {
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount || sel.isCollapsed) return;
      var span = document.createElement("span");
      span.style.fontSize = dir === "up" ? "1.2em" : "0.85em";
      try {
        var r = sel.getRangeAt(0);
        span.appendChild(r.extractContents());
        r.insertNode(span);
        sel.removeAllRanges();
      } catch (e) {}
    }
    function saveClean() {
      exitEdit();
      var clone = document.documentElement.cloneNode(true);
      ["cd-edit-toggle", "cd-toolbar"].forEach(function (id) {
        var e = clone.querySelector("#" + id); if (e) e.remove();
      });
      clone.querySelectorAll("[contenteditable]").forEach(function (e) { e.removeAttribute("contenteditable"); });
      var cls = clone.querySelector("body"); if (cls) cls.classList.remove("cd-editing", "results-mode");
      var html = "<!DOCTYPE html>\n" + clone.outerHTML;
      try {
        var blob = new Blob([html], { type: "text/html" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "dream_zone_reading.html";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      } catch (e) {
        alert("Saqlashda xato. Iltimos faylni tashqi brauzerda (Chrome/Safari) oching.");
      }
    }
  }
})();
