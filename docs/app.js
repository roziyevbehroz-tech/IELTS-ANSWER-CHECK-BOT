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
    return fetch(CFG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || ("Xato " + r.status));
        return j;
      });
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
    var b = el("button", "btn btn-navy", "Qaytadan");
    b.onclick = retry || screenBooks;
    w.appendChild(b);
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
      screenResult(res);
    }).catch(function (e) {
      errorScreen(e.message, function () { screenAnswers(answers); });
    });
  }

  function screenResult(res) {
    clearBack(); setBack(screenParts);
    var total = res.total || 0;
    var correct = (res.correct || []).length;
    var pct = total ? Math.round((correct / total) * 100) : 0;

    var wrap = el("div");
    var card = el("div", "result-card");
    var ring = el("div", "score-ring");
    ring.style.setProperty("--pct", pct + "%");
    var inner = el("div", "inner");
    inner.appendChild(el("div", "num", correct + "/" + total));
    inner.appendChild(el("div", "lbl", "to'g'ri"));
    ring.appendChild(inner);
    card.appendChild(ring);

    var msg;
    if (correct === total && total > 0) {
      msg = "🎉 Barakalla! Hammasi to'g'ri — <strong>" + total + "/" + total + "</strong>!";
    } else if (correct === 0) {
      msg = "Hozircha to'g'ri javob yo'q. Xafa bo'lmang, qayta urinib ko'ring 💪";
    } else {
      msg = "<strong>" + correct + " ta</strong> javob to'g'ri. Qolganlari ustida ishlang.";
    }
    card.appendChild(el("div", "result-msg", msg));

    if ((res.correct || []).length) {
      var chips = el("div", "chips");
      res.correct.forEach(function (q) { chips.appendChild(el("span", "chip", String(q))); });
      card.appendChild(chips);
    }
    if ((res.unanswered || []).length) {
      var u = el("div", "chips");
      res.unanswered.forEach(function (q) { u.appendChild(el("span", "chip muted", String(q))); });
      card.appendChild(el("div", "hint", "<div style='margin-top:10px'>Javob bermaganlar:</div>"));
      card.appendChild(u);
    }
    wrap.appendChild(card);

    var retry = el("button", "btn btn-primary", "🔁 Xatolarni tuzatib qayta yuborish");
    retry.onclick = function () { haptic(); screenAnswers(state.answers); };
    wrap.appendChild(retry);

    var reveal = el("button", "btn btn-navy", "🔑 To'g'ri javoblarni ko'rish");
    reveal.onclick = function () { haptic("medium"); submitReveal(); };
    wrap.appendChild(reveal);

    var home = el("button", "btn btn-ghost", "🏠 Bosh menyu");
    home.onclick = function () { haptic(); screenBooks(); };
    wrap.appendChild(home);

    hideMain();
    show(wrap);
  }

  function submitReveal() {
    loading("Javoblar yuklanmoqda…");
    api({
      action: "reveal", book: state.book, test: state.test,
      section: state.section, part: state.part,
    }).then(function (res) {
      screenReveal(res);
    }).catch(function (e) {
      errorScreen(e.message, function () { screenResult(state.lastResult); });
    });
  }

  function screenReveal(res) {
    clearBack(); setBack(function () { screenResult(state.lastResult); });
    var correctSet = {};
    (state.lastResult && state.lastResult.correct || []).forEach(function (q) { correctSet[q] = true; });

    var wrap = el("div");
    wrap.appendChild(el("div", "section-title", "To'g'ri javoblar"));
    var list = el("div", "q-list");
    (res.answers || []).forEach(function (item) {
      var mine = correctSet[item.q];
      var qr = el("div", "q-row " + (mine ? "correct" : "reveal-wrong"));
      qr.appendChild(el("div", "q-num", String(item.q)));
      var ans = el("div", "q-answer" + (mine ? "" : " wrong"), item.answer);
      ans.style.flex = "1";
      qr.appendChild(ans);
      qr.appendChild(el("div", "small", mine ? "✓ siz topdingiz" : ""));
      list.appendChild(qr);
    });
    wrap.appendChild(list);

    var home = el("button", "btn btn-primary", "🏠 Bosh menyu");
    home.onclick = function () { haptic(); screenBooks(); };
    wrap.appendChild(home);
    hideMain();
    show(wrap);
  }

  // -------------------------------- init --------------------------------

  function init() {
    if (tg) {
      tg.ready();
      tg.expand();
      try { tg.setHeaderColor && tg.setHeaderColor("#1aa0f0"); } catch (e) {}
      try { tg.setBackgroundColor && tg.setBackgroundColor("#eaf3fb"); } catch (e) {}
    }
    if (tg && !tg.initData) {
      errorScreen("Iltimos ushbu ilovani <b>Telegram bot</b> orqali oching.", null);
      return;
    }
    screenBooks();
  }

  init();
})();
