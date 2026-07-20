/* Homer Interlinear Reader — app controller.
   State lives in the URL hash: #<book>.<card>.<fidelity>[.<flavor>]
   e.g. #1.3.free.storybook — shareable and bookmarkable. */

(function () {
  "use strict";

  var DATA_ROOT = "../data/odyssey/";
  var FIDELITIES = ["interlinear", "literal", "natural", "free"];
  var FLAVORS = ["homeric", "shakespearean", "modernist", "lucretian", "storybook"];
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
    "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV"];

  var state = { book: 1, card: 1, fidelity: "natural", flavor: "homeric" };
  var manifest = null;
  var cardCache = {};

  var el = {
    greekBody: document.getElementById("greek-body"),
    englishBody: document.getElementById("english-body"),
    slider: document.getElementById("fidelity-slider"),
    fidelityLabels: document.querySelectorAll(".fidelity-labels span"),
    chips: document.querySelectorAll(".chip"),
    prev: document.getElementById("prev"),
    next: document.getElementById("next"),
    pagerLabel: document.getElementById("pager-label"),
    locationLabel: document.getElementById("location-label")
  };

  /* ---------- URL hash state ---------- */

  function readHash() {
    var parts = location.hash.replace(/^#/, "").split(".");
    var book = parseInt(parts[0], 10);
    var card = parseInt(parts[1], 10);
    if (book >= 1) state.book = book;
    if (card >= 1) state.card = card;
    if (FIDELITIES.indexOf(parts[2]) !== -1) state.fidelity = parts[2];
    if (FLAVORS.indexOf(parts[3]) !== -1) state.flavor = parts[3];
  }

  function writeHash() {
    var h = state.book + "." + state.card + "." + state.fidelity;
    if (state.fidelity === "free") h += "." + state.flavor;
    history.replaceState(null, "", "#" + h);
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

    /* Murray's 1919 prose aligns to the Greek in 5-line segments; render
       each segment in italics beneath the last Greek line it covers. */
    var murrayByEndLine = {};
    (card.murray || []).forEach(function (seg) {
      murrayByEndLine[seg.lines[1]] = seg.text;
    });

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

      el.greekBody.appendChild(div);

      if (murrayByEndLine[line.n]) {
        var gloss = document.createElement("div");
        gloss.className = "line-gloss";
        gloss.textContent = murrayByEndLine[line.n];
        el.greekBody.appendChild(gloss);
      }
    });
  }

  function renderEnglish(card) {
    el.englishBody.innerHTML = "";
    var t = card.translations;
    var content = null;

    if (t) {
      if (state.fidelity === "interlinear") content = t.interlinear;
      else if (state.fidelity === "literal") content = t.literal;
      else if (state.fidelity === "natural") content = t.natural;
      else if (state.fidelity === "free") content = t.free && t.free[state.flavor];
    }

    if (!content) {
      var p = document.createElement("p");
      p.className = "placeholder";
      p.textContent = "This translation has not been generated yet.";
      el.englishBody.appendChild(p);
      return;
    }

    if (Array.isArray(content)) {
      var wrap = document.createElement("div");
      wrap.className = "english-lines";
      content.forEach(function (lineText) {
        var d = document.createElement("div");
        d.className = "t-line";
        d.textContent = lineText;
        wrap.appendChild(d);
      });
      el.englishBody.appendChild(wrap);
    } else {
      var prose = document.createElement("div");
      prose.className = "english-prose";
      prose.textContent = content;
      el.englishBody.appendChild(prose);
    }
  }

  function renderControls() {
    el.slider.value = FIDELITIES.indexOf(state.fidelity);
    el.fidelityLabels.forEach(function (label) {
      label.classList.toggle("active",
        Number(label.dataset.stop) === FIDELITIES.indexOf(state.fidelity));
    });
    var freeActive = state.fidelity === "free";
    el.chips.forEach(function (chip) {
      chip.disabled = !freeActive;
      chip.classList.toggle("active", freeActive && chip.dataset.flavor === state.flavor);
    });
  }

  function renderChrome() {
    el.locationLabel.textContent = "Book " + (ROMAN[state.book - 1] || state.book);
    el.pagerLabel.textContent = state.card + " / " + cardCount(state.book);
    el.prev.disabled = state.card <= 1;
    el.next.disabled = state.card >= cardCount(state.book);
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

  el.prev.addEventListener("click", function () { goto(-1); });
  el.next.addEventListener("click", function () { goto(1); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") goto(-1);
    if (e.key === "ArrowRight") goto(1);
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

  el.slider.addEventListener("input", function () {
    state.fidelity = FIDELITIES[Number(el.slider.value)];
    render();
  });

  el.fidelityLabels.forEach(function (label) {
    label.addEventListener("click", function () {
      state.fidelity = FIDELITIES[Number(label.dataset.stop)];
      render();
    });
  });

  el.chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      state.flavor = chip.dataset.flavor;
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
    if (state.card > cardCount(state.book)) state.card = 1;
    render();
  }).catch(function () {
    render();
  });

})();
