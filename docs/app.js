/* IELTS Answer Check — Mini App logikasi */
(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  var CFG = window.IELTS_CONFIG || {};
  var CAT = window.IELTS_CATALOG || { books: [], tests: [], answered: {} };

  var screenEl = document.getElementById("screen");
  var crumbEl = document.getElementById("crumb");

  var state = { mode: "book", book: null, test: null, section: null, part: null, answers: {}, lastResult: null, ct: null };

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
    state.mode = "book";
    state.book = state.test = state.section = state.part = null;
    clearBack();
    hideMain();
    setCrumb([]);
    var wrap = el("div");
    var bar = el("div", "home-bar");
    var pBtn = el("button", "chip-btn", "👤 Mening testlarim");
    pBtn.onclick = function () { haptic(); screenProfile(); };
    var cBtn = el("button", "chip-btn primary", "➕ Test yaratish");
    cBtn.onclick = function () { haptic(); screenCreate(); };
    bar.appendChild(pBtn); bar.appendChild(cBtn);
    wrap.appendChild(bar);
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
    if (!prefill) state.answerStart = Date.now();
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
    var attempts = {};   // har savol necha marta yakka tekshirilgani
    var rowsA = {};
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
      // Yakka (joyida) tekshirish: xira urinishlar soni + ↻ tugma
      var tries = el("span", "q-tries");
      var chk = el("button", "q-check");
      chk.type = "button"; chk.textContent = "↻";
      chk.title = "Shu javobni tekshirish";
      (function (qq) { chk.onclick = function () { haptic(); checkRow(qq); }; })(q);
      qr.appendChild(tries);
      qr.appendChild(chk);
      rowsA[q] = { row: qr, inp: inp, tries: tries, chk: chk, solved: false };
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

    // Bitta savolni joyida tekshiradi (statistikaga yozilmaydi).
    function checkRow(q) {
      var r = rowsA[q];
      if (!r || r.solved) { if (r && r.solved) showToast(true); return; }
      var v = r.inp.value.trim();
      if (!v) { showToast(null); return; }
      var obj = {}; obj[String(q)] = v;
      var payload = (state.mode === "custom")
        ? { action: "ct_check_one", id: state.ct.id, answers: obj }
        : { action: "check_one", book: state.book, test: state.test,
            section: state.section, part: state.part, answers: obj };
      r.chk.classList.add("loading");
      attempts[q] = (attempts[q] || 0) + 1;
      r.tries.textContent = String(attempts[q]);
      api(payload).then(function (res) {
        r.chk.classList.remove("loading");
        var ok = res && res.correct && res.correct.indexOf(Number(q)) !== -1;
        if (ok) {
          r.solved = true;
          r.row.classList.add("correct");
          r.inp.disabled = true;
          r.chk.classList.add("q-ok");
          r.tries.classList.add("solved");
          haptic("light");
          showToast(true);
        } else {
          r.row.classList.add("q-miss");
          setTimeout(function () { r.row.classList.remove("q-miss"); }, 600);
          showToast(false);
        }
      }).catch(function () {
        r.chk.classList.remove("loading");
        attempts[q] = Math.max(0, attempts[q] - 1);  // tarmoq xatosi urinish sanalmasin
        r.tries.textContent = attempts[q] ? String(attempts[q]) : "";
      });
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
    state.lastElapsed = state.answerStart ? Math.round((Date.now() - state.answerStart) / 1000) : 0;
    var payload = (state.mode === "custom")
      ? { action: "ct_check", id: state.ct.id, answers: answers, elapsed: state.lastElapsed }
      : {
          action: "check", book: state.book, test: state.test,
          section: state.section, part: state.part, answers: answers,
        };
    api(payload).then(function (res) {
      state.lastResult = res;
      state.revealMap = null;
      screenResult(res);
    }).catch(function (e) {
      errorScreen(e.message, function () {
        if (state.mode === "custom") screenCustomAnswers(answers); else screenAnswers(answers);
      });
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
    var payload = (state.mode === "custom")
      ? { action: "ct_reveal", id: state.ct.id }
      : { action: "reveal", book: state.book, test: state.test, section: state.section, part: state.part };
    return api(payload).then(function (res) {
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
    clearBack();
    setBack(state.mode === "custom"
      ? function () { screenCustomAnswers(state.answers); }
      : screenParts);
    hideMain();
    var qs = (state.mode === "custom" && state.ct)
      ? state.ct.qnums.slice()
      : questionsInRange(state.book, state.test, state.section, state.part);
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
    if (state.lastElapsed) card.appendChild(el("div", "time-line", "⏱ Sarflangan vaqt: " + fmtDur(state.lastElapsed)));
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

    // To'g'ri javoblarni fonда oldindan yuklab qo'yamiz (ko'rsatmaymiz) —
    // "ko'rsatish" bosilganda darrov chiqsin, aylanib turmasin.
    ensureReveal().catch(function () {});
  }


  // ============== Foydalanuvchi testlari: profil / yaratish / boshqaruv ==============

  function popup(msg) { if (tg && tg.showPopup) tg.showPopup({ message: msg }); else alert(msg); }
  var _toastTimer = null;
  function showToast(ok) {
    var t = document.getElementById("dz-toast");
    if (!t) return;
    var kind = ok === null ? "info" : ok ? "ok" : "err";
    t.textContent = ok === null ? "✍️ Iltimos, avval javob kiriting."
      : ok ? "🎉 Barakalla! To'g'ri javob."
      : "❌ Javobingiz xato. Boshqa javob bilan yana urinib ko'ring.";
    t.className = "dz-toast show " + kind;
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () { t.className = "dz-toast " + kind; }, 3000);
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtDur(sec) { sec = Math.max(0, sec | 0); var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }
  function fmtDate(s) {
    try { var d = new Date(s); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
    catch (e) { return s; }
  }
  function isoIn(hours) { return new Date(Date.now() + hours * 3600 * 1000).toISOString(); }
  function shareLink(id) { return "https://t.me/" + (CFG.botUsername || "") + "?start=t_" + id; }

  function statusBadge(st) {
    var map = { active: ["Faol", "b-active"], paused: ["To'xtatilgan", "b-paused"], closed: ["Yakunlangan", "b-closed"] };
    var m = map[st] || map.active;
    return el("span", "badge " + m[1], m[0]);
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
  }
  function copyText(text, btn) {
    function done() { if (btn) { var o = btn.textContent; btn.textContent = "✅ Nusxalandi"; setTimeout(function () { btn.textContent = o; }, 1500); } }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
        return;
      }
    } catch (e) {}
    legacyCopy(text); done();
  }
  function confirmThen(msg, fn) {
    if (tg && tg.showConfirm) tg.showConfirm(msg, function (ok) { if (ok) fn(); });
    else if (confirm(msg)) fn();
  }

  // O'quvchi: test javoblarini kiritish
  function screenCustomAnswers(prefill) {
    state.mode = "custom";
    clearBack(); setBack(null);
    if (!prefill || Object.keys(prefill).length === 0) state.answerStart = Date.now();
    var qs = state.ct.qnums;
    setCrumb([state.ct.title]);
    var wrap = el("div");
    var head = el("div", "form-head");
    var row = el("div", "row");
    row.appendChild(el("div", "label", state.ct.title));
    row.appendChild(el("div", "meta", qs.length + " ta savol"));
    head.appendChild(row);
    head.appendChild(el("div", "meta", "Javoblaringizni kiriting. Faqat to'g'rilari ko'rsatiladi."));
    wrap.appendChild(head);

    var listWrap = el("div", "q-list");
    var inputs = {};
    qs.forEach(function (q) {
      var qr = el("div", "q-row");
      qr.appendChild(el("div", "q-num", String(q)));
      var inp = el("input", "q-input"); inp.type = "text";
      inp.setAttribute("autocomplete", "off"); inp.setAttribute("autocapitalize", "off");
      inp.placeholder = "javob…";
      if (prefill && prefill[q] != null) inp.value = prefill[q];
      inputs[q] = inp; qr.appendChild(inp); listWrap.appendChild(qr);
    });
    wrap.appendChild(listWrap);
    show(wrap);

    setupMain("✅ Tekshirish", function () {
      var a = {};
      Object.keys(inputs).forEach(function (q) { var v = inputs[q].value.trim(); if (v) a[q] = v; });
      if (Object.keys(a).length === 0) { popup("Iltimos kamida bitta javob kiriting."); return; }
      state.answers = a; submitCheck(a);
    });
  }

  // Profil: mening testlarim
  function screenProfile() {
    state.mode = "book";
    clearBack(); setBack(screenBooks); hideMain();
    setCrumb(["Mening testlarim"]);
    loading("Yuklanmoqda…");
    api({ action: "ct_list" }).then(function (res) {
      var wrap = el("div");
      var create = el("button", "btn btn-primary", "➕ Yangi test yaratish");
      create.onclick = function () { haptic(); screenCreate(); };
      wrap.appendChild(create);
      var tests = res.tests || [];
      if (!tests.length) {
        var n = el("div", "notice");
        n.appendChild(el("div", "big-ico", "📝"));
        n.appendChild(el("div", "", "<p>Hali test yaratmagansiz. Yuqoridagi tugma orqali birinchi testingizni yarating.</p>"));
        wrap.appendChild(n);
      } else {
        wrap.appendChild(el("div", "section-title", "Mening testlarim (" + tests.length + ")"));
        var list = el("div", "q-list");
        tests.forEach(function (t) {
          var card = el("div", "ct-card");
          var top = el("div", "ct-top");
          top.appendChild(el("div", "ct-title", esc(t.title)));
          top.appendChild(statusBadge(t.status));
          card.appendChild(top);
          card.appendChild(el("div", "ct-meta", t.total + " savol · 👥 " + t.students + " o'quvchi · " + t.submissions + " urinish"));
          card.onclick = function () { haptic(); screenManage(t.id); };
          list.appendChild(card);
        });
        wrap.appendChild(list);
      }
      show(wrap);
    }).catch(function (e) { errorScreen(e.message, screenProfile); });
  }

  // Namuna matnni tahlil qilish: 1-qator nom (raqamsiz), keyin "1. A", "4-d", "5,a" ...
  function parsePasted(text) {
    var answers = {}, title = "";
    (text || "").split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m = line.match(/^(\d{1,3})\s*[\.\)\-:,\]]*\s*(.+)$/);
      if (m) answers[parseInt(m[1], 10)] = m[2].trim();
      else if (!title) title = line;
    });
    return { title: title, answers: answers };
  }
  function answersToText(ans) {
    return Object.keys(ans).map(Number).sort(function (a, b) { return a - b; })
      .map(function (q) { return q + ". " + ans[q]; }).join("\n");
  }

  function screenCreate() { screenTestForm(null); }
  function screenEdit(id) {
    loading("Yuklanmoqda…");
    api({ action: "ct_get", id: id }).then(function (t) {
      screenTestForm({ id: t.id, title: t.title, answers: t.answers || {} });
    }).catch(function (e) { errorScreen(e.message, function () { screenManage(id); }); });
  }

  // Test yaratish / tahrirlash (namuna bo'yicha copy-paste)
  function screenTestForm(existing) {
    state.mode = "book";
    clearBack();
    setBack(existing ? function () { screenManage(existing.id); } : screenProfile);
    hideMain();
    setCrumb([existing ? "Tahrirlash" : "Yangi test"]);
    var wrap = el("div");
    var head = el("div", "form-head");
    head.appendChild(el("div", "label", existing ? "Testni tahrirlash" : "Yangi test yaratish"));
    head.appendChild(el("div", "meta", "Namuna bo'yicha joylang: 1-qator — test nomi, keyin tartib raqamli javoblar."));
    wrap.appendChild(head);

    var titleInp = el("input", "q-input title-input"); titleInp.type = "text";
    titleInp.placeholder = "Test nomi (ixtiyoriy — 1-qatorga ham yozsa bo'ladi)";
    if (existing) titleInp.value = existing.title;
    var titleBox = el("div", "q-row"); titleBox.appendChild(titleInp);
    wrap.appendChild(titleBox);

    wrap.appendChild(el("div", "section-title", "Javoblar (namuna bo'yicha)"));
    var ta = el("textarea", "paste-area");
    ta.rows = 12;
    ta.placeholder = "Animal\n1. A\n2. B\n3. c\n4-d\n5,a";
    if (existing) ta.value = answersToText(existing.answers);
    wrap.appendChild(ta);
    wrap.appendChild(el("div", "hint", "Qo'llab-quvvatlanadi: <b>1. A</b> · <b>1) A</b> · <b>4-d</b> · <b>5,a</b> · <b>1 A</b>"));
    show(wrap);

    setupMain(existing ? "💾 Saqlash" : "✅ Testni yaratish", function () {
      var parsed = parsePasted(ta.value);
      var title = titleInp.value.trim() || parsed.title || "Nomsiz test";
      var answers = parsed.answers;
      if (Object.keys(answers).length === 0) { popup("Javoblarni namuna bo'yicha kiriting (masalan: 1. A)."); return; }
      hideMain(); loading(existing ? "Saqlanmoqda…" : "Test yaratilmoqda…");
      if (existing) {
        api({ action: "ct_update", id: existing.id, title: title, answers: answers })
          .then(function () { screenManage(existing.id); })
          .catch(function (e) { errorScreen(e.message, function () { screenTestForm(existing); }); });
      } else {
        api({ action: "ct_create", title: title, answers: answers })
          .then(function (res) { screenShare(res.id, title, res.total); })
          .catch(function (e) { errorScreen(e.message, function () { screenTestForm(null); }); });
      }
    });
  }

  function screenShare(id, title, total) {
    state.mode = "book";
    clearBack(); setBack(screenProfile); hideMain();
    setCrumb(["Test tayyor"]);
    var link = shareLink(id);
    var wrap = el("div");
    var n = el("div", "notice");
    n.appendChild(el("div", "big-ico", "✅"));
    n.appendChild(el("div", "", "<p><b>" + esc(title) + "</b> yaratildi!<br>" + total + " ta savol</p>"));
    wrap.appendChild(n);
    wrap.appendChild(el("div", "section-title", "Ulashish havolasi"));
    wrap.appendChild(el("div", "link-box", esc(link)));
    var copyBtn = el("button", "btn btn-primary", "📋 Havolani nusxalash");
    copyBtn.onclick = function () { haptic(); copyText(link, copyBtn); };
    wrap.appendChild(copyBtn);
    var shareBtn = el("button", "btn btn-navy", "📤 Telegram orqali ulashish");
    shareBtn.onclick = function () {
      haptic();
      var u = "https://t.me/share/url?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(title);
      if (tg && tg.openTelegramLink) tg.openTelegramLink(u); else window.open(u, "_blank");
    };
    wrap.appendChild(shareBtn);
    var manageBtn = el("button", "btn btn-ghost", "🛠 Boshqarish va statistika");
    manageBtn.onclick = function () { haptic(); screenManage(id); };
    wrap.appendChild(manageBtn);
    show(wrap);
  }

  function mngBtn(label, fn) { var b = el("button", "ctrl-btn", label); b.onclick = function () { haptic(); fn(); }; return b; }
  function manage(id, op, closesAt) {
    loading("Bajarilmoqda…");
    api({ action: "ct_manage", id: id, op: op, closesAt: closesAt })
      .then(function () { screenManage(id); })
      .catch(function (e) { errorScreen(e.message, function () { screenManage(id); }); });
  }

  function screenManage(id) {
    state.mode = "book";
    clearBack(); setBack(screenProfile); hideMain();
    setCrumb(["Boshqaruv"]);
    loading("Yuklanmoqda…");
    api({ action: "ct_stats", id: id }).then(function (res) {
      var wrap = el("div");
      var head = el("div", "form-head");
      var row = el("div", "row");
      row.appendChild(el("div", "label", esc(res.title)));
      row.appendChild(statusBadge(res.status));
      head.appendChild(row);
      head.appendChild(el("div", "meta", res.total + " savol · 👥 " + res.students.length + " o'quvchi · " + res.totalAttempts + " urinish"));
      if (res.closesAt) head.appendChild(el("div", "meta", "⏱ Muddat: " + fmtDate(res.closesAt)));
      wrap.appendChild(head);

      var link = shareLink(id);
      wrap.appendChild(el("div", "link-box", esc(link)));
      var copyBtn = el("button", "btn btn-ghost", "📋 Havolani nusxalash");
      copyBtn.onclick = function () { haptic(); copyText(link, copyBtn); };
      wrap.appendChild(copyBtn);

      var editBtn = el("button", "btn btn-navy", "✏️ Savollarni tahrirlash");
      editBtn.onclick = function () { haptic(); screenEdit(id); };
      wrap.appendChild(editBtn);

      wrap.appendChild(el("div", "section-title", "Boshqaruv"));
      var ctrls = el("div", "ctrl-grid");
      if (res.status === "active") ctrls.appendChild(mngBtn("⏸ To'xtatib turish", function () { manage(id, "pause"); }));
      else if (res.status === "paused") ctrls.appendChild(mngBtn("▶️ Davom ettirish", function () { manage(id, "resume"); }));
      if (res.status !== "closed") {
        ctrls.appendChild(mngBtn("🔒 Yakunlash", function () { confirmThen("Testni butunlay yakunlaysizmi?", function () { manage(id, "close"); }); }));
        ctrls.appendChild(mngBtn("⏱ 1 kun muddat", function () { manage(id, "deadline", isoIn(24)); }));
        ctrls.appendChild(mngBtn("⏱ 1 hafta muddat", function () { manage(id, "deadline", isoIn(24 * 7)); }));
      } else {
        ctrls.appendChild(mngBtn("♻️ Qayta faollashtirish", function () { manage(id, "resume"); }));
      }
      wrap.appendChild(ctrls);

      wrap.appendChild(el("div", "section-title", "O'quvchilar natijasi"));
      if (!res.students.length) {
        wrap.appendChild(el("div", "hint", "Hali javob berilmagan."));
      } else {
        var list = el("div", "q-list");
        res.students.sort(function (a, b) { return b.best - a.best; }).forEach(function (s) {
          var r = el("div", "stat-row");
          var col = el("div", "stat-col");
          col.appendChild(el("div", "stat-name", esc(s.name) + (s.username ? " <span class='muted-txt'>@" + esc(s.username) + "</span>" : "")));
          col.appendChild(el("div", "stat-meta", fmtDate(s.last) + " · " + s.attempts + " urinish" + (s.time ? " · ⏱ " + fmtDur(s.time) : "")));
          r.appendChild(col);
          r.appendChild(el("div", "stat-score", s.best + "/" + s.total));
          list.appendChild(r);
        });
        wrap.appendChild(list);
      }

      var back = el("button", "btn btn-ghost", "⬅️ Mening testlarim");
      back.onclick = function () { haptic(); screenProfile(); };
      wrap.appendChild(back);

      var del = el("button", "btn btn-danger", "🗑 Testni o'chirish");
      del.onclick = function () {
        haptic("medium");
        confirmThen("Bu test va uning barcha natijalari butunlay o'chiriladi. Davom etasizmi?", function () {
          loading("O'chirilmoqda…");
          api({ action: "ct_delete", id: id })
            .then(function () { screenProfile(); })
            .catch(function (e) { errorScreen(e.message, function () { screenManage(id); }); });
        });
      };
      wrap.appendChild(del);
      show(wrap);
    }).catch(function (e) { errorScreen(e.message, function () { screenManage(id); }); });
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

    // Deep-link: foydalanuvchi testi (?ct=ID yoki startapp=ct_ID)
    var ctId = null;
    try { ctId = new URLSearchParams(location.search).get("ct"); } catch (e) {}
    if (!ctId && tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
      var sp = tg.initDataUnsafe.start_param;
      if (sp.indexOf("ct_") === 0) ctId = sp.slice(3);
    }
    if (ctId) { openCustomTest(ctId); return; }

    screenBooks();
  }

  function openCustomTest(id) {
    loading("Test yuklanmoqda…");
    api({ action: "ct_meta", id: id }).then(function (m) {
      if (m.status !== "active") {
        errorScreen(m.status === "paused"
          ? "⏸️ Bu test vaqtincha to'xtatilgan."
          : "🔒 Bu test yakunlangan.", null);
        return;
      }
      state.mode = "custom"; state.ct = m; state.answers = {};
      screenCustomAnswers({});
    }).catch(function (e) { errorScreen(e.message || "Test topilmadi.", null); });
  }

  init();
})();
