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

  // ------------------------------ i18n ------------------------------
  // Interfeys tarjimalari (uz/ru/en). Test MAZMUNI (passage/savol/javob/variant)
  // tarjima qilinmaydi — inglizcha qoladi. Standart til: CD_DATA.settings.lang
  // (bot generatsiya paytida qo'yadi), foydalanuvchi 🌐 bilan almashtiradi.
  var I18N = {
    uz: {
      part_n: function (l) { return "Part " + l; },
      read_text: function (r) { return r ? "Matnni o'qing va " + r + " savollarga javob bering." : "Matnni o'qing."; },
      timer_toggle: "Pauza/Davom", timer_reset: "Qayta boshlash", theme_toggle: "Tungi/kunduzgi rejim",
      edit_mode: "Tahrirlash rejimi", fmt_bold: "Qalin", fmt_italic: "Kursiv", fmt_underline: "Tagchiziq",
      align_left: "Chapga", align_center: "Markaz", align_right: "O'ngga",
      size_up: "Kattalashtirish", size_down: "Kichiklashtirish",
      save_title: "Yakuniy faylni saqlash", exit_title: "Chiqish", btn_save: "💾 Saqlash",
      edit_hint: "Matn/savollarni tahrirlang · rasmlarni ✖ bilan o'chiring",
      hl_add: "🖍 Highlight", hl_remove: "🚫 Olib tashlash",
      prev_part: "Oldingi savol", next_part: "Keyingi savol", deliver: "Topshirish ✓",
      results: "Natija", score: "Ball:", band: "IELTS Band:",
      reveal: "👁 Javoblarni ko'rish", close_fix: "✏️ Yopish va tuzatish",
      toast_need: "✍️ Iltimos, avval javob kiriting.",
      toast_ok: "🎉 Barakalla! To'g'ri javob.",
      toast_wrong: "❌ Javobingiz xato. Boshqa javob bilan yana urinib ko'ring.",
      check_one: "Shu javobni tekshirish", not_answered: "Not Answered",
      row_eye: "Javobni ko'rish/yashirish",
      res_all_correct: "🎉 Barakalla! Hammasi to'g'ri.",
      res_hint: function (w) { return "✅ To'g'ri javoblar qulflandi. «Yopish»ni bosib, qolgan <b>" + w + " ta</b> xato javobni tuzatib, yana topshiring. Yoki to'g'ri javoblarni ko'rish uchun quyidagi tugmani bosing."; },
      save_error: "Saqlashda xato. Iltimos faylni tashqi brauzerda (Chrome/Safari) oching.",
      img_del: "Rasmni o'chirish",
      vocab_title: "Mening lug'atim", vocab_add_title: "Lug'atga qo'shish",
      vocab_empty: "Hozircha so'z yo'q. Matndan so'z belgilab ＋ ni bosing.",
      vocab_added: "✅ Lug'atga qo'shildi", vocab_exists: "Bu so'z allaqachon bor",
      vocab_del_title: "O'chirish", vocab_copy_title: "Barchasini nusxalash",
      vocab_copied: "✅ Nusxalandi", vocab_tr_ph: "tarjima…",
      vocab_col_word: "So'z", vocab_col_tr: "Tarjima", vocab_col_def: "Izoh",
      vocab_def_title: "Ma'nosi (izoh)", def_loading: "Yuklanmoqda…",
      def_none: "Izoh topilmadi", vocab_no_def: "—",
    },
    ru: {
      part_n: function (l) { return "Часть " + l; },
      read_text: function (r) { return r ? "Прочитайте текст и ответьте на вопросы " + r + "." : "Прочитайте текст."; },
      timer_toggle: "Пауза/Продолжить", timer_reset: "Сбросить", theme_toggle: "Ночной/дневной режим",
      edit_mode: "Режим редактирования", fmt_bold: "Жирный", fmt_italic: "Курсив", fmt_underline: "Подчёркнутый",
      align_left: "По левому краю", align_center: "По центру", align_right: "По правому краю",
      size_up: "Увеличить", size_down: "Уменьшить",
      save_title: "Сохранить готовый файл", exit_title: "Выход", btn_save: "💾 Сохранить",
      edit_hint: "Редактируйте текст/вопросы · удаляйте картинки через ✖",
      hl_add: "🖍 Выделить", hl_remove: "🚫 Убрать",
      prev_part: "Предыдущий вопрос", next_part: "Следующий вопрос", deliver: "Отправить ✓",
      results: "Результат", score: "Балл:", band: "IELTS Band:",
      reveal: "👁 Показать ответы", close_fix: "✏️ Закрыть и исправить",
      toast_need: "✍️ Пожалуйста, сначала введите ответ.",
      toast_ok: "🎉 Отлично! Правильный ответ.",
      toast_wrong: "❌ Ответ неверный. Попробуйте другой вариант.",
      check_one: "Проверить этот ответ", not_answered: "Not Answered",
      row_eye: "Показать/скрыть ответ",
      res_all_correct: "🎉 Отлично! Всё верно.",
      res_hint: function (w) { return "✅ Правильные ответы зафиксированы. Нажмите «Закрыть», исправьте оставшиеся <b>" + w + "</b> неверных ответа и отправьте снова. Или нажмите кнопку ниже, чтобы увидеть правильные ответы."; },
      save_error: "Ошибка сохранения. Пожалуйста, откройте файл во внешнем браузере (Chrome/Safari).",
      img_del: "Удалить картинку",
      vocab_title: "Мой словарь", vocab_add_title: "Добавить в словарь",
      vocab_empty: "Пока нет слов. Выделите слово в тексте и нажмите ＋.",
      vocab_added: "✅ Добавлено в словарь", vocab_exists: "Это слово уже есть",
      vocab_del_title: "Удалить", vocab_copy_title: "Копировать всё",
      vocab_copied: "✅ Скопировано", vocab_tr_ph: "перевод…",
      vocab_col_word: "Слово", vocab_col_tr: "Перевод", vocab_col_def: "Значение",
      vocab_def_title: "Значение", def_loading: "Загрузка…",
      def_none: "Значение не найдено", vocab_no_def: "—",
    },
    en: {
      part_n: function (l) { return "Part " + l; },
      read_text: function (r) { return r ? "Read the text and answer questions " + r + "." : "Read the text."; },
      timer_toggle: "Pause/Resume", timer_reset: "Reset", theme_toggle: "Dark/light mode",
      edit_mode: "Edit mode", fmt_bold: "Bold", fmt_italic: "Italic", fmt_underline: "Underline",
      align_left: "Align left", align_center: "Center", align_right: "Align right",
      size_up: "Increase size", size_down: "Decrease size",
      save_title: "Save the final file", exit_title: "Exit", btn_save: "💾 Save",
      edit_hint: "Edit the text/questions · delete images with ✖",
      hl_add: "🖍 Highlight", hl_remove: "🚫 Remove",
      prev_part: "Previous question", next_part: "Next question", deliver: "Submit ✓",
      results: "Result", score: "Score:", band: "IELTS Band:",
      reveal: "👁 Show answers", close_fix: "✏️ Close and fix",
      toast_need: "✍️ Please enter an answer first.",
      toast_ok: "🎉 Well done! Correct answer.",
      toast_wrong: "❌ Your answer is wrong. Try a different one.",
      check_one: "Check this answer", not_answered: "Not Answered",
      row_eye: "Show/hide answer",
      res_all_correct: "🎉 Well done! All correct.",
      res_hint: function (w) { return "✅ Correct answers are locked. Press «Close», fix the remaining <b>" + w + "</b> wrong answers and submit again. Or press the button below to see the correct answers."; },
      save_error: "Save failed. Please open the file in an external browser (Chrome/Safari).",
      img_del: "Delete image",
      vocab_title: "My vocabulary", vocab_add_title: "Add to vocabulary",
      vocab_empty: "No words yet. Select a word in the text and tap ＋.",
      vocab_added: "✅ Added to vocabulary", vocab_exists: "Already in your vocabulary",
      vocab_del_title: "Delete", vocab_copy_title: "Copy all",
      vocab_copied: "✅ Copied", vocab_tr_ph: "translation…",
      vocab_col_word: "Word", vocab_col_tr: "Translation", vocab_col_def: "Definition",
      vocab_def_title: "Meaning", def_loading: "Loading…",
      def_none: "No definition found", vocab_no_def: "—",
    },
  };
  var CD_LANGS = ["uz", "ru", "en"];
  function isLang(l) { return CD_LANGS.indexOf(l) !== -1; }
  var LANG = (function () {
    var l = null;
    try { l = localStorage.getItem("cd-lang"); } catch (e) {}
    if (!isLang(l)) l = (S.lang || "").toString().toLowerCase();
    if (!isLang(l)) l = "uz";
    return l;
  })();
  function T(key) {
    var d = I18N[LANG] || I18N.uz;
    var v = d[key];
    if (v === undefined) v = I18N.uz[key];
    if (typeof v === "function") return v.apply(null, Array.prototype.slice.call(arguments, 1));
    return v == null ? key : v;
  }
  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var arg = el.getAttribute("data-i18narg");
      el.textContent = arg != null ? T(el.getAttribute("data-i18n"), arg) : T(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", T(el.getAttribute("data-i18n-title")));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", T(el.getAttribute("data-i18n-aria")));
    });
  }
  function setupLangToggle() {
    var b = document.getElementById("cd-lang-toggle");
    if (!b) return;
    b.textContent = "🌐 " + LANG.toUpperCase();
    b.addEventListener("click", function () {
      LANG = CD_LANGS[(CD_LANGS.indexOf(LANG) + 1) % CD_LANGS.length];
      try { localStorage.setItem("cd-lang", LANG); } catch (e) {}
      b.textContent = "🌐 " + LANG.toUpperCase();
      applyI18n();
      buildBottomNav();
      renderVocab();
      var modal = document.getElementById("results-modal");
      if (modal && !modal.classList.contains("hidden")) setResultsHint();
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    applyI18n();
    setupLangToggle();
    setupTimer();
    setupResizer();
    setupParts();
    setupEditor();
    setupHighlight();
    setupVocab();
    setupDarkMode();
    injectPerQuestion();
    // Yakka «tekshirish» tugmalari (event delegation)
    var mc = document.getElementById("main-container") || document.body;
    mc.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".q-check") : null;
      if (btn) { e.preventDefault(); checkOne(parseInt(btn.getAttribute("data-q"), 10)); }
    });
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

  // ---------------------------- dark mode ----------------------------
  function setupDarkMode() {
    var btn = document.getElementById("cd-theme-toggle");
    if (!btn) return;
    function apply(dark) {
      document.body.classList.toggle("cd-dark", dark);
      btn.textContent = dark ? "☀️" : "🌙";
      try { localStorage.setItem("cd-theme", dark ? "dark" : "light"); } catch (e) {}
    }
    var saved = null;
    try { saved = localStorage.getItem("cd-theme"); } catch (e) {}
    apply(saved === "dark");
    btn.addEventListener("click", function () {
      apply(!document.body.classList.contains("cd-dark"));
    });
  }

  // ----------------------------- resizer -----------------------------
  // Kompyuterda chap/o'ng (col-resize), telefonda tepa/past (row-resize).
  // Sichqoncha VA teginish (touch) qo'llab-quvvatlanadi.
  function setupResizer() {
    var rez = document.getElementById("resizer");
    var left = document.getElementById("passage-panel");
    var right = document.getElementById("questions-panel");
    var cont = document.querySelector(".panels-container");
    if (!rez || !left || !right || !cont) return;
    var dragging = false;
    function isVertical() { return getComputedStyle(cont).flexDirection === "column"; }
    function start(e) { dragging = true; document.body.style.userSelect = "none"; if (e.cancelable) e.preventDefault(); }
    function end() { dragging = false; document.body.style.userSelect = ""; }
    function move(clientX, clientY) {
      if (!dragging) return;
      var rect = cont.getBoundingClientRect();
      if (isVertical()) {
        var pv = ((clientY - rect.top) / rect.height) * 100;
        pv = Math.max(18, Math.min(82, pv));
        left.style.flex = "0 0 " + pv + "%";
        left.style.maxHeight = "none";       // 42vh cheklovini olib tashlaymiz
        right.style.flex = "1 1 auto";
      } else {
        var ph = ((clientX - rect.left) / rect.width) * 100;
        ph = Math.max(25, Math.min(75, ph));
        left.style.flex = "0 0 " + ph + "%";
        right.style.flex = "0 0 " + (100 - ph) + "%";
      }
    }
    rez.addEventListener("mousedown", start);
    window.addEventListener("mouseup", end);
    window.addEventListener("mousemove", function (e) { move(e.clientX, e.clientY); });
    rez.addEventListener("touchstart", start, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      var t = e.touches[0]; if (!t) return;
      if (e.cancelable) e.preventDefault();
      move(t.clientX, t.clientY);
    }, { passive: false });
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
      lbl.textContent = T("part_n", (D.partNos && D.partNos[i - 1]) || i);
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
      // Faqat AYNAN shu savol blokini belgilaymiz (butun MCQ/TFNG guruhini emas):
      // avval yakka savol o'ramlari (mcq/tfng/matching/diagram/qator), keyin guruh.
      var wrap = (el.closest && (
        el.closest(".multi-choice-question") ||
        el.closest(".tf-question") ||
        el.closest(".matching-form-row") ||
        el.closest(".diagram-row") ||
        el.closest(".statement") ||
        el.closest("li") || el.closest("td") || el.closest("p") ||
        el.closest(".question"))) || el;
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
    var markBtn = document.getElementById("hl-mark");
    var addBtn = document.getElementById("hl-add");
    var defBtn = document.getElementById("hl-def");
    if (!root || !pop) return;
    var lastText = "", lastRect = null;
    // Mavjud highlight ustiga bosib olib tashlash
    root.addEventListener("click", function (e) {
      var m = e.target.closest ? e.target.closest(".cd-hl") : null;
      if (m && !document.body.classList.contains("cd-editing")) unwrapMark(m);
    });
    root.addEventListener("mouseup", function () {
      if (document.body.classList.contains("cd-editing")) return;
      setTimeout(function () {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) { hideHL(); return; }
        var range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) { hideHL(); return; }
        lastText = sel.toString().trim();
        lastRect = range.getBoundingClientRect();
        hideDefCloud();   // yangi tanlov — eski bulutni yopamiz
        // Tanlov highlight ustida bo'lsa — tugma "olib tashlash" rejimida
        if (markBtn) markBtn.textContent = marksInRange(range).length ? T("hl_remove") : T("hl_add");
        // Panelni so'z OSTIGA joylashtiramiz (bulut ustidan chiqadi)
        pop.classList.remove("hidden");
        var w = pop.offsetWidth || 140;
        pop.style.top = (window.scrollY + lastRect.bottom + 8) + "px";
        pop.style.left = (window.scrollX + lastRect.left + lastRect.width / 2 - w / 2) + "px";
      }, 10);
    });
    pop.addEventListener("mousedown", function (e) { e.preventDefault(); });
    if (markBtn) markBtn.addEventListener("click", function () {
      highlightSelection();
      hideHL();
    });
    if (defBtn) defBtn.addEventListener("click", function () {
      if (lastText && lastRect) showDefCloud(lastRect, lastText);
    });
    if (addBtn) addBtn.addEventListener("click", function () {
      var r = addBtn.getBoundingClientRect();
      var fromX = r.left + r.width / 2, fromY = r.top + r.height / 2;
      var text = lastText;
      pop.classList.add("hidden"); hideDefCloud();
      var sel = window.getSelection(); if (sel) sel.removeAllRanges();
      if (text) addVocabWord(text).then(function (added) { if (added) flyToVocab(fromX, fromY); });
    });
    document.addEventListener("mousedown", function (e) {
      var cloud = document.getElementById("cd-def-cloud");
      if (!pop.contains(e.target) && !(cloud && cloud.contains(e.target))) hideHL();
    });
  }
  function hideHL() {
    var pop = document.getElementById("hl-popup");
    if (pop) pop.classList.add("hidden");
    hideDefCloud();
  }
  function hideDefCloud() {
    var cloud = document.getElementById("cd-def-cloud");
    if (cloud) { cloud.classList.remove("show"); cloud.classList.add("hidden"); }
  }
  // Ma'no buluti — so'z USTIDAN chiqadi (barcha ma'nolar, scroll bilan)
  function showDefCloud(rect, word) {
    var cloud = document.getElementById("cd-def-cloud");
    if (!cloud) return;
    var wordEl = cloud.querySelector(".cd-def-word");
    var listEl = cloud.querySelector(".cd-def-list");
    wordEl.textContent = word;
    listEl.innerHTML = '<div class="cd-def-msg">' + esc(T("def_loading")) + '</div>';
    cloud.classList.remove("hidden");
    function place() {
      var w = cloud.offsetWidth || 330, h = cloud.offsetHeight || 120;
      var vw = document.documentElement.clientWidth;
      var left = rect.left + rect.width / 2 - w / 2;
      left = Math.max(6, Math.min(left, vw - w - 6));
      cloud.style.left = (window.scrollX + left) + "px";
      cloud.style.top = (window.scrollY + rect.top - h - 12) + "px";
    }
    place();
    requestAnimationFrame(function () { cloud.classList.add("show"); place(); });
    if (window.CDDict && window.CDDict.lookup) {
      window.CDDict.lookup(word).then(function (res) {
        listEl.innerHTML = defListHtml(res);
        place();
      }).catch(function () { listEl.innerHTML = '<div class="cd-def-msg">' + esc(T("def_none")) + '</div>'; place(); });
    } else {
      listEl.innerHTML = '<div class="cd-def-msg">' + esc(T("def_none")) + '</div>';
    }
  }
  function defListHtml(res) {
    if (!res || !res.defs || !res.defs.length) return '<div class="cd-def-msg">' + esc(T("def_none")) + '</div>';
    return res.defs.map(function (d) {
      return '<div class="cd-def-item">' +
        (d[0] ? '<span class="cd-def-pos">' + esc(d[0]) + '</span>' : '') +
        '<span class="cd-def-text">' + esc(d[1]) + '</span></div>';
    }).join("");
  }

  // ---------------------------- vocabulary ----------------------------
  // Matndan belgilangan so'zlarni saqlash (localStorage). Pop-up jadval;
  // har so'zni tasdiq bilan o'chirish mumkin.
  // Har yozuv: { w: so'z, t: tarjima }. Eski (faqat so'z, string) format ham o'qiladi.
  var VOCAB_KEY = "cd-vocab";
  function loadVocab() {
    try {
      var raw = JSON.parse(localStorage.getItem(VOCAB_KEY) || "[]") || [];
      return raw.map(function (x) {
        if (typeof x === "string") return { w: x, d: [], t: "" };
        return { w: (x && x.w) || "", d: (x && x.d) || [], t: (x && x.t) || "" };
      }).filter(function (x) { return x.w; });
    } catch (e) { return []; }
  }
  function saveVocab(arr) { try { localStorage.setItem(VOCAB_KEY, JSON.stringify(arr)); } catch (e) {} }
  function hasWord(v, w) { var l = w.toLowerCase(); return v.some(function (x) { return x.w.toLowerCase() === l; }); }
  // Async: so'z qo'shishdan oldin offline lug'atdan izohni topib saqlaydi
  function addVocabWord(text) {
    var w = (text || "").replace(/\s+/g, " ").trim();
    if (!w) return Promise.resolve(false);
    if (w.length > 90) w = w.slice(0, 90);
    if (hasWord(loadVocab(), w)) { vocabToast(T("vocab_exists")); return Promise.resolve(false); }
    function finish(defs) {
      var v = loadVocab();
      if (hasWord(v, w)) return false;
      v.push({ w: w, d: defs || [], t: "" }); saveVocab(v);
      updateVocabBadge(); renderVocab();
      vocabToast(T("vocab_added"));
      return true;
    }
    if (window.CDDict && window.CDDict.lookup) {
      return window.CDDict.lookup(w).then(function (res) {
        return finish(res && res.defs ? res.defs : []);
      }).catch(function () { return finish([]); });
    }
    return Promise.resolve(finish([]));
  }
  function removeVocabWord(w) {
    saveVocab(loadVocab().filter(function (x) { return x.w !== w; }));
    updateVocabBadge();
  }
  function setVocabTr(w, tr) {
    var v = loadVocab();
    for (var i = 0; i < v.length; i++) if (v[i].w === w) { v[i].t = tr; break; }
    saveVocab(v);
  }
  function updateVocabBadge() {
    var c = document.getElementById("cd-vocab-count");
    if (!c) return;
    var n = loadVocab().length;
    c.textContent = n; c.classList.toggle("hidden", n === 0);
  }
  function renderVocab() {
    var list = document.getElementById("cd-vocab-list");
    var empty = document.getElementById("cd-vocab-empty");
    var cols = document.getElementById("cd-vocab-cols");
    if (!list) return;
    var v = loadVocab();
    if (empty) empty.classList.toggle("hidden", v.length > 0);
    if (cols) cols.classList.toggle("hidden", v.length === 0);
    list.innerHTML = "";
    v.forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "cd-vocab-item";
      item.innerHTML =
        '<span class="cd-vocab-word"></span>' +
        '<div class="cd-vocab-def"></div>' +
        '<input class="cd-vocab-tr" type="text" autocomplete="off" placeholder="' + esc(T("vocab_tr_ph")) + '">' +
        '<button class="cd-vocab-del" title="' + esc(T("vocab_del_title")) + '" aria-label="delete">🗑</button>' +
        '<span class="cd-vocab-cf"><button class="cd-vocab-yes" aria-label="confirm">✓</button>' +
        '<button class="cd-vocab-no" aria-label="cancel">✕</button></span>';
      item.querySelector(".cd-vocab-word").textContent = entry.w;
      var defEl = item.querySelector(".cd-vocab-def");
      if (entry.d && entry.d.length) {
        defEl.innerHTML = entry.d.map(function (d) {
          return '<div class="vd">' + (d[0] ? '<span class="vp">' + esc(d[0]) + '</span>' : '') + esc(d[1]) + '</div>';
        }).join("");
      } else {
        defEl.innerHTML = '<span class="vd-empty">' + esc(T("vocab_no_def")) + '</span>';
      }
      var tr = item.querySelector(".cd-vocab-tr");
      tr.value = entry.t || "";
      item._word = entry.w;
      list.appendChild(item);
    });
  }
  function vocabText() {
    return loadVocab().map(function (x) { return x.t ? (x.w + " — " + x.t) : x.w; }).join("\n");
  }
  function vocabToast(text) {
    var t = document.getElementById("cd-toast");
    if (!t) return;
    t.textContent = text;
    t.className = "cd-toast show info";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "cd-toast info"; }, 2200);
  }
  // ＋ bosilganda so'zdan yuqoridagi list ikonkasiga uchib boradigan nuqta + "bump"
  function flyToVocab(fromX, fromY) {
    var btn = document.getElementById("cd-vocab-btn");
    if (!btn) return;
    var to = btn.getBoundingClientRect();
    var dot = document.createElement("div");
    dot.className = "cd-fly-dot";
    dot.style.left = fromX + "px";
    dot.style.top = fromY + "px";
    document.body.appendChild(dot);
    var dx = (to.left + to.width / 2) - fromX;
    var dy = (to.top + to.height / 2) - fromY;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        dot.style.transform = "translate(" + dx + "px," + dy + "px) scale(.25)";
        dot.style.opacity = "0.2";
      });
    });
    setTimeout(function () {
      if (dot.parentNode) dot.parentNode.removeChild(dot);
      btn.classList.add("cd-vocab-bump");
      setTimeout(function () { btn.classList.remove("cd-vocab-bump"); }, 300);
    }, 520);
  }
  function copyVocab(btn) {
    var text = vocabText();
    if (!text) return;
    function done() {
      if (!btn) return;
      btn.classList.add("copied");
      setTimeout(function () { btn.classList.remove("copied"); }, 1400);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { legacyCopyVocab(text); done(); });
      } else { legacyCopyVocab(text); done(); }
    } catch (e) { legacyCopyVocab(text); done(); }
    vocabToast(T("vocab_copied"));
  }
  function legacyCopyVocab(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
  }
  function setupVocab() {
    var btn = document.getElementById("cd-vocab-btn");
    var panel = document.getElementById("cd-vocab-panel");
    var closeB = document.getElementById("cd-vocab-close");
    var copyB = document.getElementById("cd-vocab-copy");
    var list = document.getElementById("cd-vocab-list");
    if (!btn || !panel) return;
    updateVocabBadge(); renderVocab();
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (panel.classList.contains("show")) { panel.classList.remove("show"); }
      else { renderVocab(); panel.classList.add("show"); }
    });
    if (closeB) closeB.addEventListener("click", function () { panel.classList.remove("show"); });
    if (copyB) copyB.addEventListener("click", function () { copyVocab(copyB); });
    document.addEventListener("mousedown", function (e) {
      if (panel.classList.contains("show") && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove("show");
      }
    });
    if (list) {
      list.addEventListener("click", function (e) {
        var item = e.target.closest ? e.target.closest(".cd-vocab-item") : null;
        if (!item) return;
        if (e.target.closest(".cd-vocab-del")) { item.classList.add("confirming"); return; }
        if (e.target.closest(".cd-vocab-no")) { item.classList.remove("confirming"); return; }
        if (e.target.closest(".cd-vocab-yes")) {
          var w = item._word;
          item.classList.add("removing");
          setTimeout(function () { removeVocabWord(w); renderVocab(); }, 220);
        }
      });
      // Tarjima kiritilganda saqlash
      list.addEventListener("input", function (e) {
        var tr = e.target.closest ? e.target.closest(".cd-vocab-tr") : null;
        if (!tr) return;
        var item = tr.closest(".cd-vocab-item");
        if (item && item._word != null) setVocabTr(item._word, tr.value);
      });
    }
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
  var attempts = {};  // har bir savol necha marta tekshirilgani (to'g'ri topilguncha)

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
    updateAllTries();

    showResults(score, rows);
  }

  function checkSingle(q, kind, key) {
    if (!locked[q]) attempts[q] = (attempts[q] || 0) + 1;
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
    for (var qa = g.start; qa <= g.end; qa++) if (!locked[qa]) attempts[qa] = (attempts[qa] || 0) + 1;
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
    if (allCorrect) for (var ql = g.start; ql <= g.end; ql++) locked[ql] = true;
    var rows = [], label = expected.join(", ");
    var chosenLabel = chosen.length ? chosen.join(", ") : T("not_answered");
    for (var i = 0; i < expected.length; i++) {
      rows.push(rowData(g.start + i, i === 0 ? chosenLabel : "", label, i < got));
    }
    return { score: got, rows: rows };
  }

  function rowData(q, user, key, correct) {
    return { q: q, user: user || T("not_answered"), key: Array.isArray(key) ? key.join(" / ") : key, correct: correct };
  }

  // -------------------- yakka (joyida) tekshirish --------------------
  function qAnchor(q) {
    var el = document.getElementById("q" + q);            // gap / select / diagram
    if (el) return { el: el, mode: "after" };
    var grp = document.querySelector('[data-qgroup="q' + q + '"]');  // tfng/ynng/mcq
    if (grp) return { el: grp, mode: "append" };
    var g = groupOf(q);                                   // mcq_multi (guruh boshiga bitta)
    if (g && g.kind === "mcq_multi" && q === g.start) {
      var box = document.querySelector('input[name="qm' + g.start + '"]');
      var cont = box && box.closest ? box.closest(".question") : null;
      if (cont) return { el: cont, mode: "append" };
    }
    return null;
  }
  function injectPerQuestion() {
    Object.keys(D.answers).map(Number).forEach(function (q) {
      if (document.querySelector('.q-check[data-q="' + q + '"]')) return;
      var a = qAnchor(q);
      if (!a) return;
      var wrap = document.createElement("span");
      wrap.className = "q-check-wrap";
      wrap.innerHTML =
        '<button type="button" class="q-check" data-q="' + q + '" ' +
        'title="' + esc(T("check_one")) + '" aria-label="check">↻</button>' +
        '<span class="q-tries" data-q="' + q + '"></span>';
      if (a.mode === "after") {
        if (a.el.parentNode) a.el.parentNode.insertBefore(wrap, a.el.nextSibling);
      } else { a.el.appendChild(wrap); }
    });
    updateAllTries();
  }
  function clearQMark(q) {
    var el = document.getElementById("q" + q);
    if (el) {
      el.classList.remove("incorrect");
      var d = el.parentNode && el.parentNode.querySelector(".correct-answer-display");
      if (d) d.remove();
      var mr = el.closest ? el.closest(".matching-form-row") : null;
      if (mr) mr.classList.remove("incorrect");
    }
    var grp = document.querySelector('[data-qgroup="q' + q + '"]');
    if (grp) grp.querySelectorAll(".incorrect").forEach(function (x) { x.classList.remove("incorrect"); });
  }
  function checkOne(q) {
    if (locked[q]) { updateTries(q); showToast(true); return; }
    if (!isAnswered(q)) { showToast(null); return; }
    var g = groupOf(q), kind = g ? g.kind : "gap", ok;
    clearQMark(q);
    if (kind === "mcq_multi") { checkMulti(g); for (var n = g.start; n <= g.end; n++) updateTries(n); ok = !!locked[g.start]; }
    else { checkSingle(q, kind, D.answers[q]); updateTries(q); ok = !!locked[q]; }
    showToast(ok);
  }
  var toastTimer = null;
  function showToast(ok) {
    var t = document.getElementById("cd-toast");
    if (!t) return;
    var kind = ok === null ? "info" : ok ? "ok" : "err";
    t.textContent = ok === null ? T("toast_need") : ok ? T("toast_ok") : T("toast_wrong");
    t.className = "cd-toast show " + kind;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "cd-toast " + kind; }, 3000);
  }
  function updateTries(q) {
    var span = document.querySelector('.q-tries[data-q="' + q + '"]');
    if (!span) return;
    var n = attempts[q] || 0;
    span.textContent = n ? String(n) : "";
    span.classList.toggle("solved", !!locked[q]);
    var btn = document.querySelector('.q-check[data-q="' + q + '"]');
    if (btn) btn.classList.toggle("q-ok", !!locked[q]);
  }
  function updateAllTries() {
    Object.keys(D.answers).map(Number).forEach(updateTries);
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
    setResultsHint();
    renderRows();
    var rv = document.getElementById("reveal-button");
    if (rv) rv.style.display = (revealed || wrong === 0) ? "none" : "";
    document.getElementById("results-modal").classList.remove("hidden");
  }

  // Natija oynasidagi izohni joriy tilda o'rnatadi (til almashtirilganda ham)
  function setResultsHint() {
    var hint = document.getElementById("results-hint");
    if (!hint) return;
    var wrong = lastRows.filter(function (r) { return !r.correct; }).length;
    hint.innerHTML = wrong === 0 ? T("res_all_correct") : T("res_hint", wrong);
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
              "' title='" + esc(T("row_eye")) + "' aria-label='toggle'>" +
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
  // Passage VA butun savol bloklari tahrirlanadi (form elementlari atomik qoladi)
  var EDIT_SEL = ".reading-passage, .question, .part-header, .flowchart, .diagram-block";

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
      addImageDeleters();
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
      removeImageDeleters();
      toolbar.classList.add("hidden");
      toggle.textContent = "✏️";
    }
    // Tahrirlash rejimida rasmlarga ✖ (o'chirish) tugmasini qo'shamiz —
    // ortiqcha logo/rasmlarni olib tashlash uchun. Header brend logosi tegilmaydi.
    function addImageDeleters() {
      var mc = document.getElementById("main-container");
      if (!mc) return;
      mc.querySelectorAll("img").forEach(function (img) {
        if (img.classList.contains("brand-logo")) return;
        if (img.parentNode && img.parentNode.classList && img.parentNode.classList.contains("cd-img-wrap")) return;
        var wrap = document.createElement("span");
        wrap.className = "cd-img-wrap";
        wrap.setAttribute("contenteditable", "false");
        img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(img);
        img.classList.add("cd-deletable");
        var del = document.createElement("button");
        del.type = "button"; del.className = "cd-img-del"; del.textContent = "✖";
        del.title = T("img_del");
        del.addEventListener("mousedown", function (e) { e.preventDefault(); });
        del.addEventListener("click", function (e) {
          e.preventDefault(); e.stopPropagation();
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        });
        wrap.appendChild(del);
      });
    }
    function removeImageDeleters() {
      document.querySelectorAll(".cd-img-wrap").forEach(function (wrap) {
        var del = wrap.querySelector(".cd-img-del");
        if (del) wrap.removeChild(del);
        var img = wrap.querySelector("img");
        if (img) { img.classList.remove("cd-deletable"); wrap.parentNode.insertBefore(img, wrap); }
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      });
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
      var vp = clone.querySelector("#cd-vocab-panel"); if (vp) vp.classList.remove("show");
      var dc = clone.querySelector("#cd-def-cloud"); if (dc) { dc.classList.remove("show"); dc.classList.add("hidden"); }
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
        alert(T("save_error"));
      }
    }
  }
})();
