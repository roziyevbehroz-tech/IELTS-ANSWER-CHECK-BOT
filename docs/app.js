/* IELTS Answer Check — Mini App logikasi */
(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  var CFG = window.IELTS_CONFIG || {};
  var CAT = window.IELTS_CATALOG || { books: [], tests: [], answered: {} };

  var screenEl = document.getElementById("screen");
  var crumbEl = document.getElementById("crumb");

  var state = { book: null, test: null, section: null, part: null, answers: {}, lastResult: null };

  var SECTIONS = {
    listening: {
      label: "Listening", icon: "🎧",
      parts: [
        { id: "1", label: "Part 1", range: [1, 10] },
        { id: "2", label: "Part 2", range: [11, 20] },
        { id: "3", label: "Part 3", range: [21, 30] },
        { id: "4", label: "Part 4", range: [31, 40] },
      ],
    },
    reading: {
      label: "Reading", icon: "📖",
      parts: [
        { id: "1", label: "Passage 1", range: [1, 13] },
        { id: "2", label: "Passage 2", range: [14, 26] },
        { id: "3", label: "Passage 3", range: [27, 40] },
      ],
    },
  };

  // -------------------------------- util --------------------------------

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function haptic(type) {
    try { tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred(type || "light"); } catch (e) {}
  }

  function answeredFor(book, test, section) {
    return CAT.answered[book + "-" + test + "-" + section] || [];
  }

  function questionsInRange(book, test, section, part) {
    var list = answeredFor(book, test, section);
    if (part === "all") return list.slice();
    var sec = SECTIONS[section];
    var p = sec.parts.filter(function (x) { return x.id === part; })[0];
    if (!p) return list.slice();
    return list.filter(function (q) { return q >= p.range[0] && q <= p.range[1]; });
  }

  function setCrumb(parts) {
    crumbEl.textContent = parts.filter(Boolean).join("  ›  ");
  }

  function show(node) {
    screenEl.innerHTML = "";
    node.classList.add("fade-in");
    screenEl.appendChild(node);
    window.scrollTo(0, 0);
  }

  function setBack(fn) {
    if (!tg || !tg.BackButton) return;
    if (fn) {
      tg.BackButton.show();
      tg.BackButton.onClick(fn);
      state._back = fn;
    } else {
      tg.BackButton.hide();
    }
  }
  function clearBack() {
    if (tg && tg.BackButton && state._back) {
      tg.BackButton.offClick(state._back);
      state._back = null;
    }
    if (tg && tg.BackButton) tg.BackButton.hide();
  }
  function hideMain() { if (tg && tg.MainButton) tg.MainButton.hide(); }

  // ------------------------------ screens ------------------------------

  function screenBooks() {
    state.book = state.test = state.section = state.part = null;
    clearBack();
    hideMain();
    setCrumb([]);
    var wrap = el("div");
    wrap.appendChild(el("div", "section-title", "Kitobni tanlang"));
    var grid = el("div", "grid books");
    CAT.books.forEach(function (b) {
      var t = el("div", "tile");
      t.appendChild(el("div", "big", String(b)));
      t.appendChild(el("div", "small", "Cambridge"));
      t.onclick = function () { haptic(); state.book = b; screenTests(); };
      grid.appendChild(t);
    });
    wrap.appendChild(grid);
    show(wrap);
  }

  function screenTests() {
    clearBack(); setBack(screenBooks); hideMain();
    setCrumb(["Cambridge " + state.book]);
    var wrap = el("div");
    wrap.appendChild(el("div", "section-title", "Testni tanlang"));
    var grid = el("div", "grid tests");
    CAT.tests.forEach(function (n) {
      var t = el("div", "tile");
      t.appendChild(el("div", "big", "Test " + n));
      grid.appendChild(t);
      t.onclick = function () { haptic(); state.test = n; screenSection(); };
    });
    wrap.appendChild(grid);
    show(wrap);
  }

  function screenSection() {
    clearBack(); setBack(screenTests); hideMain();
    setCrumb(["Cambridge " + state.book, "Test " + state.test]);
    var wrap = el("div");
    wrap.appendChild(el("div", "section-title", "Bo'limni tanlang"));
    var grid = el("div", "grid");
    ["listening", "reading"].forEach(function (key) {
      var s = SECTIONS[key];
      var has = answeredFor(state.book, state.test, key).length > 0;
      var card = el("div", "tile section-card" + (has ? "" : " disabled"));
      card.appendChild(el("div", "ico", s.icon));
      var col = el("div", "col");
      col.appendChild(el("div", "t", s.label));
      col.appendChild(el("div", "d", key === "listening" ? "40 savol · 4 Part" : "40 savol · 3 Passage"));
      card.appendChild(col);
      grid.appendChild(card);
      if (has) card.onclick = function () { haptic(); state.section = key; screenParts(); };
    });
    wrap.appendChild(grid);
    show(wrap);
  }

  function screenParts() {
    clearBack(); setBack(screenSection); hideMain();
    var s = SECTIONS[state.section];
    setCrumb(["Cambridge " + state.book, "Test " + state.test, s.label]);
    var wrap = el("div");
    wrap.appendChild(el("div", "section-title", "Qismni tanlang"));
    var grid = el("div", "grid parts");
    s.parts.forEach(function (p) {
      var count = questionsInRange(state.book, state.test, state.section, p.id).length;
      var t = el("div", "tile" + (count ? "" : " disabled"));
      t.appendChild(el("div", "big", p.label));
      t.appendChild(el("div", "small", "Q" + p.range[0] + "–" + p.range[1] + " · " + count + " ta"));
      grid.appendChild(t);
      if (count) t.onclick = function () { haptic(); state.part = p.id; screenAnswers(); };
    });
    // To'liq test
    var fullCount = questionsInRange(state.book, state.test, state.section, "all").length;
    var full = el("div", "tile wide" + (fullCount ? "" : " disabled"));
    full.appendChild(el("div", "big", "📋 To'liq test"));
    full.appendChild(el("div", "small", "Barcha savollar · " + fullCount + " ta"));
    if (fullCount) full.onclick = function () { haptic(); state.part = "all"; screenAnswers(); };
    grid.appendChild(full);
    wrap.appendChild(grid);
    show(wrap);
  }

  function partLabel() {
    if (state.part === "all") return "To'liq test";
    var p = SECTIONS[state.section].parts.filter(function (x) { return x.id === state.part; })[0];
    return p ? p.label : "";
  }

  function screenAnswers(prefill) {
    clearBack(); setBack(screenParts);
    var s = SECTIONS[state.section];
    var qs = questionsInRange(state.book, state.test, state.section, state.part);
    setCrumb(["Cambridge " + state.book, "Test " + state.test, s.label, partLabel()]);

    var wrap = el("div");
    var head = el("div", "form-head");
    var row = el("div", "row");
    row.appendChild(el("div", "label", s.label + " · " + partLabel()));
    row.appendChild(el("div", "meta", qs.length + " ta savol"));
    head.appendChild(row);
    head.appendChild(el("div", "meta", "Javoblaringizni har bir savol uchun kiriting. Faqat to'g'rilari ko'rsatiladi."));
    wrap.appendChild(head);

    var listWrap = el("div", "q-list");
    var inputs = {};
    qs.forEach(function (q) {
      var qr = el("div", "q-row");
      qr.appendChild(el("div", "q-num", String(q)));
      var inp = el("input", "q-input");
      inp.type = "text";
      inp.setAttribute("autocomplete", "off");
      inp.setAttribute("autocapitalize", "off");
      inp.placeholder = "javob…";
      if (prefill && prefill[q] != null) inp.value = prefill[q];
      inputs[q] = inp;
      qr.appendChild(inp);
      listWrap.appendChild(qr);
    });
    wrap.appendChild(listWrap);
    show(wrap);

    function collect() {
      var a = {};
      Object.keys(inputs).forEach(function (q) {
        var v = inputs[q].value.trim();
        if (v) a[q] = v;
      });
      return a;
    }

    setupMain("✅ Tekshirish", function () {
      var answers = collect();
      if (Object.keys(answers).length === 0) {
        tg && tg.showPopup ? tg.showPopup({ message: "Iltimos kamida bitta javob kiriting." })
                          : alert("Iltimos kamida bitta javob kiriting.");
        return;
      }
      state.answers = answers;
      submitCheck(answers);
    });
  }

  function setupMain(text, onClick) {
    if (!tg || !tg.MainButton) return;
    var mb = tg.MainButton;
    mb.setParams({ text: text, color: "#1aa0f0", text_color: "#ffffff" });
    if (state._main) mb.offClick(state._main);
    state._main = onClick;
    mb.onClick(onClick);
    mb.show();
    mb.enable();
  }

  // ------------------------------ network ------------------------------

  function api(payload) {
    payload.initData = tg ? tg.initData : "";
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    return fetch(CFG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || ("Xato " + r.status));
        return j;
      });
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      if (e && e.name === "AbortError") {
        throw new Error("Internet javob bermadi. Qayta urinib ko'ring.");
      }
      throw e;
    });
  }

  function loading(msg) {
    var w = el("div");
    w.appendChild(el("div", "spinner"));
    w.appendChild(el("div", "hint", "<div style='text-align:center'>" + (msg || "Tekshirilmoqda…") + "</div>"));
    show(w);
  }

  function errorScreen(message, retry) {
    hideMain();
    var w = el("div");
    var n = el("div", "notice");
    n.appendChild(el("div", "big-ico", "⚠️"));
    n.appendChild(el("div", "", "<p>" + message + "</p>"));
    w.appendChild(n);
    var b = el("button", "btn btn-primary", "Qaytadan urinish");
    b.onclick = retry || screenBooks;
    w.appendChild(b);
    var rl = el("button", "btn btn-ghost", "🔄 Ilovani yangilash");
    rl.onclick = function () { try { location.reload(); } catch (e) {} };
    w.appendChild(rl);
    show(w);
  }

  function submitCheck(answers) {
    hideMain(); clearBack();
    loading("Javoblar tekshirilmoqda…");
    api({
      action: "check", book: state.book, test: state.test,
      section: state.section, part: state.part, answers: answers,
    }).then(function (res) {
      state.lastResult = res;
      state.revealMap = null;
      screenResult(res);
    }).catch(function (e) {
      errorScreen(e.message, function () { screenAnswers(answers); });
    });
  }

  // HTML-escape (foydalanuvchi matni / javoblar xavfsiz ko'rsatilishi uchun)
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function statusOf(q, res) {
    var ok = (res.correct || []).indexOf(q) !== -1;
    if (ok) return "correct";
    var na = (res.unanswered || []).indexOf(q) !== -1;
    if (na) return "unanswered";
    return "wrong";
  }

  function statusIcon(st) {
    if (st === "correct") return el("span", "ic ic-ok", "✓");
    if (st === "wrong") return el("span", "ic ic-no", "✕");
    return el("span", "ic ic-na", "–");
  }

  function resultMessage(correct, total) {
    if (total > 0 && correct === total) return "🎉 Barakalla! Hammasi to'g'ri — <strong>" + total + "/" + total + "</strong>!";
    if (correct === 0) return "Hozircha to'g'ri javob yo'q. Xafa bo'lmang, qayta urinib ko'ring 💪";
    return "<strong>" + correct + " ta</strong> to'g'ri. Qolganlari ustida ishlang yoki javobni ko'ring.";
  }

  function animateRing(ring, numEl, correct, total, pct) {
    var dur = 750, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      ring.style.setProperty("--pct", (pct * e) + "%");
      numEl.textContent = Math.round(correct * e) + "/" + total;
      if (p < 1) requestAnimationFrame(step);
      else { ring.style.setProperty("--pct", pct + "%"); numEl.textContent = correct + "/" + total; }
    }
    requestAnimationFrame(step);
  }

  // To'g'ri javoblarni serverdan bir marta olib, keshlaymiz (foydalanuvchi so' raganda).
  function ensureReveal() {
    if (state.revealMap) return Promise.resolve(state.revealMap);
    return api({
      action: "reveal", book: state.book, test: state.test,
      section: state.section, part: state.part,
    }).then(function (res) {
      var m = {};
      (res.answers || []).forEach(function (it) { m[it.q] = it.answer; });
      state.revealMap = m;
      return m;
    });
  }

  function confetti() {
    try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred("success"); } catch (e) {}
    var colors = ["#1aa0f0", "#0e7bc4", "#1aa260", "#e8a33d", "#ffffff"];
    var c = el("div", "confetti");
    for (var i = 0; i < 44; i++) {
      var p = el("span");
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.35) + "s";
      p.style.width = (6 + Math.random() * 6) + "px";
      c.appendChild(p);
    }
    document.body.appendChild(c);
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 2800);
  }

  function screenResult(res) {
    clearBack(); setBack(screenParts); hideMain();
    var qs = questionsInRange(state.book, state.test, state.section, state.part);
    var total = res.total || qs.length;
    var correct = (res.correct || []).length;
    var pct = total ? Math.round((correct / total) * 100) : 0;
    var hasWrong = false;
    for (var wi = 0; wi < qs.length; wi++) {
      if (statusOf(qs[wi], res) !== "correct") { hasWrong = true; break; }
    }

    var wrap = el("div");

    // ----- Ball kartasi -----
    var card = el("div", "result-card");
    var ring = el("div", "score-ring");
    ring.style.setProperty("--pct", "0%");
    var inner = el("div", "inner");
    var numEl = el("div", "num", "0/" + total);
    inner.appendChild(numEl);
    inner.appendChild(el("div", "lbl", "to'g'ri"));
    ring.appendChild(inner);
    card.appendChild(ring);
    card.appendChild(el("div", "result-msg", resultMessage(correct, total)));
    if (hasWrong) card.appendChild(el("div", "edit-hint",
      "✏️ Xato javoblarni shu yerda tuzatib, «🔄 Qayta tekshirish»ni bosing."));
    wrap.appendChild(card);

    // ----- Javoblar ro'yxati (animatsion) -----
    var list = el("div", "q-list ans-list");
    var rows = {};
    var inputs = {};
    qs.forEach(function (q, i) {
      var st = statusOf(q, res);
      var row = el("div", "ans-row st-" + st);
      row.style.animationDelay = (i * 70) + "ms";

      row.appendChild(el("div", "q-num", String(q)));

      var body = el("div", "ans-body");
      var ua = state.answers[q];
      if (st === "correct") {
        // To'g'ri javob — qulflangan (qayta yozish shart emas)
        body.appendChild(el("div", "ans-user", esc(ua != null ? ua : "")));
      } else {
        // Xato yoki bo'sh — shu yerda tuzatish mumkin
        var input = el("input", "q-input ans-input");
        input.type = "text";
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocapitalize", "off");
        input.placeholder = "javobni tuzating…";
        if (ua != null) input.value = ua;
        body.appendChild(input);
        inputs[q] = input;
      }
      var corr = el("div", "ans-correct");
      body.appendChild(corr);
      row.appendChild(body);

      var status = el("div", "ans-status");
      status.appendChild(el("span", "mini-spin"));
      row.appendChild(status);

      var eye = el("button", "eye-btn", "👁");
      eye.setAttribute("aria-label", "Javobni ko'rsatish");
      row.appendChild(eye);

      function revealThis() {
        if (row.classList.contains("revealed")) return;
        eye.classList.add("loading");
        ensureReveal().then(function (m) {
          eye.classList.remove("loading");
          var ans = (m[q] != null) ? m[q] : "—";
          corr.innerHTML = "<span class='corr-label'>To'g'ri javob:</span> " + esc(ans);
          row.classList.add("revealed");
          eye.classList.add("hidden");
          haptic("light");
        }).catch(function () { eye.classList.remove("loading"); });
      }
      eye.onclick = function () { haptic(); revealThis(); };

      list.appendChild(row);
      rows[q] = { row: row, status: status, st: st, reveal: revealThis };
    });
    wrap.appendChild(list);

    // ----- Tugmalar -----
    if (hasWrong) {
      var recheck = el("button", "btn btn-primary", "🔄 Qayta tekshirish");
      recheck.onclick = function () {
        haptic();
        var merged = {};
        Object.keys(state.answers).forEach(function (k) { merged[k] = state.answers[k]; });
        Object.keys(inputs).forEach(function (k) {
          var v = inputs[k].value.trim();
          if (v) merged[k] = v; else delete merged[k];
        });
        state.answers = merged;
        submitCheck(merged);
      };
      wrap.appendChild(recheck);
    }

    var revealAllBtn = el("button", "btn btn-navy", "👁 Barcha to'g'ri javoblarni ko'rsatish");
    revealAllBtn.onclick = function () {
      haptic("medium");
      revealAllBtn.disabled = true;
      revealAllBtn.textContent = "Yuklanmoqda…";
      ensureReveal().then(function () {
        revealAllBtn.classList.add("hidden");
        qs.forEach(function (q, i) {
          setTimeout(function () { rows[q].reveal(); }, i * 80);
        });
      }).catch(function () {
        revealAllBtn.disabled = false;
        revealAllBtn.textContent = "👁 Barcha to'g'ri javoblarni ko'rsatish";
      });
    };
    wrap.appendChild(revealAllBtn);

    var home = el("button", "btn btn-ghost", "🏠 Bosh menyu");
    home.onclick = function () { haptic(); screenBooks(); };
    wrap.appendChild(home);

    show(wrap);

    // ----- Animatsiyalar: ball + navbatma-navbat ✓/✕ -----
    animateRing(ring, numEl, correct, total, pct);
    qs.forEach(function (q, i) {
      setTimeout(function () {
        var r = rows[q];
        r.status.innerHTML = "";
        r.status.appendChild(statusIcon(r.st));
        r.row.classList.add("resolved");
        haptic("light");
      }, 500 + i * 150);
    });
    if (total > 0 && correct === total) {
      setTimeout(confetti, 600 + qs.length * 150);
    }
  }


  // -------------------------------- init --------------------------------

  // Telegram WebView uzoq vaqt fonда qolsa qotib qolishi mumkin — ilova
  // qaytganda qayta tayyorlanadi (ready/expand). Bu freeze'larni kamaytiradi.
  function resume() {
    if (!tg) return;
    try { tg.ready(); } catch (e) {}
    try { tg.expand(); } catch (e) {}
  }

  function init() {
    if (tg) {
      tg.ready();
      tg.expand();
      try { tg.setHeaderColor && tg.setHeaderColor("#1aa0f0"); } catch (e) {}
      try { tg.setBackgroundColor && tg.setBackgroundColor("#eaf3fb"); } catch (e) {}
    }

    // Ilova fonдан qaytganда qayta jonlantirish (qotishni kamaytirish uchun).
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) resume();
    });
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    if (tg && tg.onEvent) { try { tg.onEvent("activated", resume); } catch (e) {} }

    if (tg && !tg.initData) {
      errorScreen("Iltimos ushbu ilovani <b>Telegram bot</b> orqali oching.", null);
      return;
    }
    screenBooks();
  }

  init();
})();
