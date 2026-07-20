/* Homer Interlinear Reader — app controller.
   State lives in the URL hash: #<book>.<card>.<style>
   e.g. #1.3.storybook — shareable and bookmarkable.
   <style> is the right-page stylized translation (shakespearean | modernist |
   storybook). The left-page crib style (interlinear | literal) is a reading
   preference kept in localStorage. */

(function () {
  "use strict";

  var DATA_ROOT = "../data/odyssey/";
  var STYLES = ["elizabethan", "modernist", "storybook"];
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
    "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV"];

  var CRIBS = ["interlinear", "literal"];
  var savedCrib = null;
  try { savedCrib = localStorage.getItem("homer-crib"); } catch (e) {}

  var state = {
    book: 1, card: 1, style: "elizabethan",
    crib: CRIBS.indexOf(savedCrib) !== -1 ? savedCrib : "literal"
  };
  var manifest = null;
  var cardCache = {};

  var el = {
    greekBody: document.getElementById("greek-body"),
    englishBody: document.getElementById("english-body"),
    styleButtons: document.querySelectorAll(".style-btn"),
    cribControls: document.getElementById("crib-controls"),
    cribLabels: document.querySelectorAll(".crib-label"),
    bookSelect: document.getElementById("book-select"),
    bookCurrent: document.getElementById("book-current"),
    bookMenu: document.getElementById("book-menu"),
    edgePrev: document.getElementById("edge-prev"),
    edgeNext: document.getElementById("edge-next"),
    pagerLabel: document.getElementById("pager-label")
  };

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

  function cardCount(book) {
    if (!manifest || !manifest.books[String(book)]) return 1;
    return manifest.books[String(book)].cards;
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

    var prose = document.createElement("div");
    prose.className = "english-prose";
    prose.textContent = content;
    el.englishBody.appendChild(prose);
  }

  function renderControls() {
    el.styleButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.style === state.style);
    });
  }

  function renderChrome() {
    el.bookCurrent.textContent = "Book " + (ROMAN[state.book - 1] || state.book);
    el.pagerLabel.textContent = state.card + " / " + cardCount(state.book);
    el.edgePrev.disabled = state.card <= 1;
    el.edgeNext.disabled = state.card >= cardCount(state.book);
  }

  /* ---------- Book selector ---------- */

  function bookList() {
    if (!manifest) return [state.book];
    return Object.keys(manifest.books).map(Number).sort(function (a, b) { return a - b; });
  }

  function buildBookMenu() {
    el.bookMenu.innerHTML = "";
    bookList().forEach(function (n) {
      var li = document.createElement("li");
      li.className = "book-option";
      li.setAttribute("role", "option");
      li.dataset.book = n;
      li.textContent = "Book " + (ROMAN[n - 1] || n);
      li.addEventListener("click", function () {
        state.book = n;
        state.card = 1;
        closeBookMenu();
        render();
      });
      el.bookMenu.appendChild(li);
    });
  }

  function openBookMenu() {
    Array.prototype.forEach.call(el.bookMenu.children, function (li) {
      li.classList.toggle("active", Number(li.dataset.book) === state.book);
    });
    el.bookMenu.hidden = false;
    el.bookCurrent.setAttribute("aria-expanded", "true");
  }

  function closeBookMenu() {
    el.bookMenu.hidden = true;
    el.bookCurrent.setAttribute("aria-expanded", "false");
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
    if (e.key === "Escape") closeBookMenu();
  });

  /* Book menu open/close */
  el.bookCurrent.addEventListener("click", function (e) {
    e.stopPropagation();
    if (el.bookMenu.hidden) openBookMenu(); else closeBookMenu();
  });
  document.addEventListener("click", function (e) {
    if (!el.bookSelect.contains(e.target)) closeBookMenu();
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
  fetchJSON(DATA_ROOT + "manifest.json").then(function (m) {
    manifest = m;
    buildBookMenu();
    if (state.card > cardCount(state.book)) state.card = 1;
    render();
  }).catch(function () {
    render();
  });

})();
