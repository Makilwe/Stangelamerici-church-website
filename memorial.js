/* In Loving Memory — renders the parish book, candles, and the share form. */
(function () {
  "use strict";
  var grid = document.getElementById("memorial-grid");
  var empty = document.getElementById("memorial-empty");
  var countLine = document.getElementById("memorial-count");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function candleLit(id) {
    try { return localStorage.getItem("memorial-candle-" + id) === "1"; }
    catch (e) { return false; }
  }
  function setCandle(id, on) {
    try {
      if (on) localStorage.setItem("memorial-candle-" + id, "1");
      else localStorage.removeItem("memorial-candle-" + id);
    } catch (e) {}
  }

  function cardHTML(m) {
    var photo = m.photo
      ? '<img class="mem-photo" src="' + esc(m.photo) + '" alt="' + esc(m.name) + '" loading="lazy">'
      : '<div class="mem-photo mem-initial" aria-hidden="true"><span>' + esc((m.name || "?").trim().charAt(0).toUpperCase()) + '</span></div>';
    var lit = candleLit(m.id) ? " lit" : "";
    return '<article class="mem-card" data-mem-id="' + esc(m.id) + '">' +
      photo +
      '<div class="mem-body">' +
        '<h3>' + esc(m.name) + '</h3>' +
        (m.dates ? '<p class="mem-dates">' + esc(m.dates) + '</p>' : '') +
        (m.words ? '<p class="mem-words">&ldquo;' + esc(m.words) + '&rdquo;</p>' : '') +
        '<div class="mem-actions">' +
          '<button type="button" class="candle-btn' + lit + '" data-candle="' + esc(m.id) + '" aria-pressed="' + (lit ? "true" : "false") + '">' +
            '<span class="candle-graphic" aria-hidden="true"><span class="flame"></span><span class="wick"></span><span class="wax"></span></span>' +
            '<span data-i18n="mem.candle">Light a candle</span>' +
          '</button>' +
          '<a class="btn-gold btn-small" href="contact.html" data-i18n="mem.mass">Request a Mass</a>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function render() {
    var list = (typeof MEMORIALS !== "undefined" && MEMORIALS) || [];
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = "";
      if (empty) empty.hidden = false;
      if (countLine) countLine.innerHTML = '<span data-i18n="mem.book.count0">lives held in our public book</span>: <strong>0</strong>';
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = list.map(cardHTML).join("");
    if (countLine) {
      countLine.innerHTML = '<span data-i18n="mem.book.count">lives held in our public book</span>: <strong>' + list.length + '</strong>';
    }
    var btns = grid.querySelectorAll("[data-candle]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        var id = this.getAttribute("data-candle");
        var on = !this.classList.contains("lit");
        this.classList.toggle("lit", on);
        this.setAttribute("aria-pressed", on ? "true" : "false");
        setCandle(id, on);
      });
    }
  }

  /* Share form -> opens the parish office email, prefilled. Photo is attached there. */
  var form = document.getElementById("memorial-form");
  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var name = document.getElementById("mem-name").value.trim();
      var dates = document.getElementById("mem-dates").value.trim();
      var words = document.getElementById("mem-words").value.trim();
      var subject = "Memorial wall submission: " + name;
      var body = "Name: " + name + "\nDates: " + dates + "\n\nWords to remember them by:\n" + words +
        "\n\n(I will attach the photo to this email before sending.)";
      window.location.href = "mailto:saintangelamerici@yahoo.com?subject=" +
        encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      var done = document.getElementById("memorial-done");
      if (done) done.hidden = false;
      form.reset();
    });
  }

  render();
})();
