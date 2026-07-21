/* Homer Interlinear Reader — app controller.
   State lives in the URL hash: #<book>.<card>.<style>
   e.g. #1.3.storybook — shareable and bookmarkable.
   <style> is the right-page stylized translation (elizabethan | modernist |
   storybook | vansanders). The left-page crib style (interlinear | literal)
   is a reading preference kept in localStorage. */

(function () {
  "use strict";

  var DATA_ROOT = "../data/odyssey/";
  var STYLES = ["elizabethan", "modernist", "storybook", "vansanders"];
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
    "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV"];

  var CRIBS = ["interlinear", "literal"];
  var PANES = ["source", "stylized"];
  var savedCrib = null, savedPane = null;
  try {
    savedCrib = localStorage.getItem("homer-crib");
    savedPane = localStorage.getItem("homer-pane");
  } catch (e) {}

  var state = {
    book: 1, card: 1, style: "elizabethan",
    crib: CRIBS.indexOf(savedCrib) !== -1 ? savedCrib : "literal",
    pane: PANES.indexOf(savedPane) !== -1 ? savedPane : "source"
  };
  var manifest = null;
  var cardCache = {};

  var el = {
    greekBody: document.getElementById("greek-body"),
    englishBody: document.getElementById("english-body"),
    styleButtons: document.querySelectorAll(".style-btn"),
    cribControls: document.getElementById("crib-controls"),
    cribLabels: document.querySelectorAll(".crib-label"),
    bookSelects: document.querySelectorAll(".book-select"),
    pageSelects: document.querySelectorAll(".page-select"),
    edgePrev: document.getElementById("edge-prev"),
    edgeNext: document.getElementById("edge-next"),
    themeToggle: document.getElementById("theme-toggle"),
    paneButtons: document.querySelectorAll(".pane-btn")
  };

  /* ---------- Mobile pane (Source / Stylized) ---------- */
  /* Which single page shows on narrow screens. CSS reads <html data-pane>;
     on desktop the attribute is inert and both pages show. */

  function applyPane() {
    document.documentElement.setAttribute("data-pane", state.pane);
    el.paneButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.pane === state.pane);
    });
  }

  el.paneButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.pane = btn.dataset.pane;
      try { localStorage.setItem("homer-pane", state.pane); } catch (e) {}
      applyPane();
    });
  });

  /* ---------- Theme ---------- */
  /* The active theme is set on <html data-theme> before first paint by the
     inline script in index.html; here we only label and flip it. */

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark" : "light";
  }

  function renderThemeToggle() {
    /* Which icon shows is handled in CSS off <html data-theme>; only the
       accessible label needs updating here. */
    var next = currentTheme() === "dark" ? "light" : "dark";
    el.themeToggle.setAttribute("aria-label", "Switch to " + next + " theme");
  }

  el.themeToggle.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("homer-theme", next); } catch (e) {}
    renderThemeToggle();
  });

  /* ---------- URL hash state ---------- */

  function readHash() {
    var parts = location.hash.replace(/^#/, "").split(".");
    var book = parseInt(parts[0], 10);
    var card = parseInt(parts[1], 10);
    if (book >= 1) state.book = book;
    if (card >= 1) state.card = card;
    if (STYLES.indexOf(parts[2]) !== -1) state.style = parts[2];
  }

  function writeHash() {
    history.replaceState(null, "", "#" + state.book + "." + state.card + "." + state.style);
  }

  /* ---------- Data loading ---------- */

  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " -> " + r.status);
      return r.json();
    });
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }

  function loadCard(book, card) {
    var key = book + "." + card;
    if (cardCache[key]) return Promise.resolve(cardCache[key]);
    var url = DATA_ROOT + "book-" + pad(book, 2) + "/card-" + pad(card, 3) + ".json";
    return fetchJSON(url).then(function (data) {
      cardCache[key] = data;
      return data;
    });
  }

  /* Only cards with line-by-line cribs are exposed, so the reader never lands
     on a page whose English is Murray's 5-line prose instead of a per-line
     crib. `authored` is maintained by pipeline/index_authored.py. */
  function cardCount(book) {
    var info = manifest && manifest.books[String(book)];
    if (!info) return 1;
    return info.authored || 0;
  }

  /* ---------- Rendering ---------- */

  function renderGreek(card) {
    el.greekBody.innerHTML = "";

    /* Preferred left-page crib: our line-by-line gloss (interlinear or literal,
       reader's choice), which aligns 1:1 with the Greek, rendered in italics
       directly under each line. Fallback for cards not yet authored: Murray's
       1919 prose, which the source only anchors every 5 lines. */
    var hasCrib = !!(card.translations &&
      card.translations.interlinear && card.translations.literal);
    var crib = hasCrib ? card.translations[state.crib] : null;

    el.cribControls.hidden = !hasCrib;
    el.cribLabels.forEach(function (label) {
      label.classList.toggle("active", label.dataset.crib === state.crib);
    });

    var murrayByEndLine = {};
    if (!crib) {
      (card.murray || []).forEach(function (seg) {
        murrayByEndLine[seg.lines[1]] = seg.text;
      });
    }

    card.lines.forEach(function (line, i) {
      var div = document.createElement("div");
      div.className = "line";

      if (i === 0 || line.n % 5 === 0) {
        var no = document.createElement("span");
        no.className = "line-no";
        no.textContent = line.n;
        div.appendChild(no);
      }

      var greek = document.createElement("div");
      greek.className = "line-greek";
      greek.textContent = line.greek;
      div.appendChild(greek);

      if (crib && crib[i]) {
        var gloss = document.createElement("div");
        gloss.className = "line-gloss";
        gloss.textContent = crib[i];
        div.appendChild(gloss);
      }

      el.greekBody.appendChild(div);

      if (murrayByEndLine[line.n]) {
        var seg = document.createElement("div");
        seg.className = "line-gloss line-gloss-prose";
        seg.textContent = murrayByEndLine[line.n];
        el.greekBody.appendChild(seg);
      }
    });
  }

  function renderEnglish(card) {
    el.englishBody.innerHTML = "";
    var content = card.translations && card.translations[state.style];

    if (!content) {
      var p = document.createElement("p");
      p.className = "placeholder";
      p.textContent = "This translation has not been written yet.";
      el.englishBody.appendChild(p);
      return;
    }

    /* Blocks are separated by blank lines. A block containing its own line
       breaks is verse (each line becomes an element so runovers can hang);
       a block without them is prose and flows normally. */
    content.split(/\n{2,}/).forEach(function (block) {
      var lines = block.split("\n");

      if (lines.length > 1) {
        var verse = document.createElement("div");
        verse.className = "verse";
        lines.forEach(function (line) {
          var d = document.createElement("div");
          d.className = "verse-line";
          d.textContent = line;
          verse.appendChild(d);
        });
        el.englishBody.appendChild(verse);
      } else {
        var p = document.createElement("p");
        p.className = "prose-para";
        p.textContent = block;
        el.englishBody.appendChild(p);
      }
    });
  }

  function renderControls() {
    el.styleButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.style === state.style);
    });
  }

  function renderChrome() {
    var bookLabel = "Book " + (ROMAN[state.book - 1] || state.book);
    el.bookSelects.forEach(function (sel) {
      sel.querySelector(".book-current").textContent = bookLabel;
    });
    el.pageSelects.forEach(function (sel) {
      var menu = sel.querySelector(".page-menu");
      if (menu.dataset.book !== String(state.book)) buildPageMenu(sel);
      sel.querySelector(".page-current").textContent = "Page " + state.card;
    });
    el.edgePrev.disabled = state.card <= 1;
    el.edgeNext.disabled = state.card >= cardCount(state.book);
  }

  /* ---------- Book and page selectors ---------- */
  /* The same location bar (book dropdown + page dropdown) appears twice — in
     the masthead and again in the bottom nav — so every build/open/close
     function takes the specific .book-select/.page-select it operates on,
     and menus across both bars are kept in sync via closeAllMenus(). */

  function bookList() {
    if (!manifest) return [state.book];
    return Object.keys(manifest.books)
      .map(Number)
      .filter(function (n) { return cardCount(n) > 0; })
      .sort(function (a, b) { return a - b; });
  }

  function buildBookMenu(sel) {
    var menu = sel.querySelector(".book-menu");
    menu.innerHTML = "";
    bookList().forEach(function (n) {
      var li = document.createElement("li");
      li.className = "book-option";
      li.setAttribute("role", "option");
      li.dataset.book = n;
      li.textContent = "Book " + (ROMAN[n - 1] || n);
      li.addEventListener("click", function () {
        state.book = n;
        state.card = 1;
        closeAllMenus();
        render();
      });
      menu.appendChild(li);
    });
  }

  function openBookMenu(sel) {
    var menu = sel.querySelector(".book-menu");
    Array.prototype.forEach.call(menu.children, function (li) {
      li.classList.toggle("active", Number(li.dataset.book) === state.book);
    });
    menu.hidden = false;
    sel.querySelector(".book-current").setAttribute("aria-expanded", "true");
  }

  function closeBookMenu(sel) {
    sel.querySelector(".book-menu").hidden = true;
    sel.querySelector(".book-current").setAttribute("aria-expanded", "false");
  }

  /* Page menu is rebuilt whenever the book changes, since each book has its
     own card count (see renderChrome). */

  function buildPageMenu(sel) {
    var menu = sel.querySelector(".page-menu");
    menu.innerHTML = "";
    var total = cardCount(state.book);
    for (var i = 1; i <= total; i++) {
      (function (n) {
        var li = document.createElement("li");
        li.className = "page-option";
        li.setAttribute("role", "option");
        li.dataset.page = n;
        li.textContent = n;
        li.addEventListener("click", function () {
          state.card = n;
          closeAllMenus();
          render();
        });
        menu.appendChild(li);
      })(i);
    }
    menu.dataset.book = state.book;
  }

  function openPageMenu(sel) {
    var menu = sel.querySelector(".page-menu");
    var active = null;
    Array.prototype.forEach.call(menu.children, function (li) {
      var on = Number(li.dataset.page) === state.card;
      li.classList.toggle("active", on);
      if (on) active = li;
    });
    menu.hidden = false;
    sel.querySelector(".page-current").setAttribute("aria-expanded", "true");
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  function closePageMenu(sel) {
    sel.querySelector(".page-menu").hidden = true;
    sel.querySelector(".page-current").setAttribute("aria-expanded", "false");
  }

  function closeAllMenus() {
    el.bookSelects.forEach(closeBookMenu);
    el.pageSelects.forEach(closePageMenu);
  }

  function render() {
    writeHash();
    renderControls();
    renderChrome();
    loadCard(state.book, state.card).then(function (card) {
      renderGreek(card);
      renderEnglish(card);
    }).catch(function (err) {
      el.greekBody.innerHTML = "";
      el.englishBody.innerHTML =
        '<p class="placeholder">Could not load this card. (' + err.message + ")</p>";
    });
  }

  /* ---------- Navigation ---------- */

  function goto(delta) {
    var next = state.card + delta;
    if (next < 1 || next > cardCount(state.book)) return;
    state.card = next;
    render();
  }

  el.edgePrev.addEventListener("click", function () { goto(-1); });
  el.edgeNext.addEventListener("click", function () { goto(1); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") goto(-1);
    if (e.key === "ArrowRight") goto(1);
    if (e.key === "Escape") closeAllMenus();
  });

  /* Only one menu is open at a time, across both location bars */
  el.bookSelects.forEach(function (sel) {
    sel.querySelector(".book-current").addEventListener("click", function (e) {
      e.stopPropagation();
      var wasOpen = !sel.querySelector(".book-menu").hidden;
      closeAllMenus();
      if (!wasOpen) openBookMenu(sel);
    });
  });
  el.pageSelects.forEach(function (sel) {
    sel.querySelector(".page-current").addEventListener("click", function (e) {
      e.stopPropagation();
      var wasOpen = !sel.querySelector(".page-menu").hidden;
      closeAllMenus();
      if (!wasOpen) openPageMenu(sel);
    });
  });
  document.addEventListener("click", function (e) {
    var insideAny = false;
    el.bookSelects.forEach(function (sel) { if (sel.contains(e.target)) insideAny = true; });
    el.pageSelects.forEach(function (sel) { if (sel.contains(e.target)) insideAny = true; });
    if (!insideAny) closeAllMenus();
  });

  /* Swipe navigation (touch) */
  var touchX = null;
  document.addEventListener("touchstart", function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) goto(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ---------- Controls wiring ---------- */

  el.styleButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.style = btn.dataset.style;
      render();
    });
  });

  el.cribLabels.forEach(function (label) {
    label.addEventListener("click", function () {
      state.crib = label.dataset.crib;
      try { localStorage.setItem("homer-crib", state.crib); } catch (e) {}
      render();
    });
  });

  window.addEventListener("hashchange", function () {
    readHash();
    render();
  });

  /* ---------- Boot ---------- */

  readHash();
  renderThemeToggle();
  applyPane();
  fetchJSON(DATA_ROOT + "manifest.json").then(function (m) {
    manifest = m;
    el.bookSelects.forEach(buildBookMenu);
    /* A hash pointing at a book or card we have not authored yet falls back to
       the first authored book. */
    if (cardCount(state.book) === 0) state.book = bookList()[0] || 1;
    if (state.card > cardCount(state.book)) state.card = 1;
    render();
  }).catch(function () {
    render();
  });

})();
