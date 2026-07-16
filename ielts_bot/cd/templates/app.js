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
    switchToPart(1);
    var db = document.getElementById("deliver-button");
    if (db) db.addEventListener("click", onDeliver);
    var rv = document.getElementById("reveal-button");
    if (rv) rv.addEventListener("click", revealAll);
    var cl = document.getElementById("modal-close");
    if (cl) cl.addEventListener("click", function () {
      document.getElementById("results-modal").classList.add("hidden");
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
      if (timeLeft > 0) { timeLeft--; render(); } else { clearInterval(timerId); timerId = null; onDeliver(); }
    }, 1000); }
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

  // ------------------------------ parts ------------------------------
  function setupParts() {
    var prev = document.getElementById("prevBtn");
    var next = document.getElementById("nextBtn");
    if (prev) prev.addEventListener("click", function () { switchToPart(Math.max(1, currentPart - 1)); });
    if (next) next.addEventListener("click", function () { switchToPart(Math.min(partCount, currentPart + 1)); });
    document.querySelectorAll(".part-tab").forEach(function (t) {
      t.addEventListener("click", function () { switchToPart(parseInt(t.dataset.part, 10)); });
    });
  }
  function switchToPart(p) {
    currentPart = p;
    for (var i = 1; i <= partCount; i++) {
      toggle("passage-text-" + i, i === p);
      toggle("questions-" + i, i === p);
      toggle("part-header-" + i, i === p);
    }
    document.querySelectorAll(".part-tab").forEach(function (t) {
      t.classList.toggle("active", parseInt(t.dataset.part, 10) === p);
    });
    var pb = document.getElementById("prevBtn"), nb = document.getElementById("nextBtn");
    if (pb) pb.disabled = p <= 1;
    if (nb) nb.disabled = p >= partCount;
    window.scrollTo(0, 0);
    var pp = document.getElementById("passage-panel"); if (pp) pp.scrollTop = 0;
    var qp = document.getElementById("questions-panel"); if (qp) qp.scrollTop = 0;
  }
  function toggle(id, show) { var e = document.getElementById(id); if (e) e.classList.toggle("hidden", !show); }

  // ---------------------------- checking -----------------------------
  // Cheksiz qayta urinish: to'g'ri javoblar qulflanadi (yashil), xato/bo'shlar
  // tahrirlanadigan qoladi. Foydalanuvchi oynani yopib, xatolarni qayta kiritib
  // yana «Deliver» bosishi mumkin — cheksiz. To'g'ri javoblar HAR DOIM darrov
  // belgilanadi; xatolarning to'g'ri varianti «Javoblarni ko'rish»da ochiladi.
  var revealed = false;
  var locked = {};

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
  function letterCorrect(user, key) {
    return (user || "").toString().trim().toUpperCase() ===
           String(key).trim().toUpperCase();
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
      // To'g'ri javob: darrov ko'rinadi. Xato: «ko'rish» bosilmaguncha yashirin.
      var keyHtml = (r.correct || revealed)
        ? "<span class='correct-answer-highlight'>" + esc(r.key) + "</span>"
        : "<span class='muted'>•••</span>";
      div.innerHTML =
        "<div class='q-num'>" + r.q + "</div>" +
        "<div class='user-ans'>" + (r.correct ? "✅ " : "❌ ") + esc(r.user) + "</div>" +
        "<div class='correct-ans'>" + keyHtml + "</div>";
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
