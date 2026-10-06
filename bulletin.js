/* ==========================================================================
   St. Angela Merici — Weekly Bulletin
   --------------------------------------------------------------------------
   HOW IT WORKS
   The secretary never touches this website. She edits a Google Sheet, and
   this page pulls the latest rows from it automatically.

   ONE-TIME SETUP (done once by the website manager):
   1. In Google Sheets: File -> Share -> Publish to web -> choose CSV.
   2. Copy the published link. It looks like:
      https://docs.google.com/spreadsheets/d/XXXX/pub?output=csv
   3. Paste it below as SHEET_CSV_URL.
   4. Deploy the site. Done.

   WEEKLY WORKFLOW (the secretary):
   Open the Sheet -> add a new row at the top -> fill in the 5 boxes ->
   close the Sheet. The website shows it within a few minutes.

   Sheet columns (in this order):
     A  date           e.g. 2026-09-27   (Sunday of that week)
     B  sunday_title   e.g. Twenty-Sixth Sunday in Ordinary Time
     C  announcements  free text, English + Spanish. Blank line between items.
     D  intentions     Mass intentions, one per line
     E  pdf_url        link to the full PDF bulletin (optional, may be empty)
   ========================================================================== */

var SHEET_CSV_URL = (typeof window !== "undefined" && window.SHEET_CSV_URL) || "";
/* (Set the link once in bulletin-config.js; it is loaded before this file.) */

/* Sample content shown until the Sheet is connected. Replace nothing here. */
var DEMO_BULLETINS = [
  {
    date: "2026-09-27",
    sunday_title: "Twenty-Sixth Sunday in Ordinary Time",
    announcements:
      "Food Pantry \u2014 open Saturdays 9:00 AM\u201312:00 PM in the Parish Hall. " +
      "Donations of canned goods are welcome at the rectory office.\n" +
      "Despensa de Alimentos \u2014 abierta los s\u00e1bados de 9:00 AM a 12:00 PM en el Sal\u00f3n Parroquial. " +
      "Se aceptan donaciones de alimentos enlatados en la oficina parroquial.\n\n" +
      "Youth Group meets Fridays at 6:00 PM in the lower church. All teens are welcome.\n" +
      "El Grupo Juvenil se re\u00fane los viernes a las 6:00 PM en la parte baja de la iglesia. Todos los j\u00f3venes son bienvenidos.\n\n" +
      "Offertory via Zelle: saintangelamerici@yahoo.com. Thank you for your support.\n" +
      "Ofrenda por Zelle: saintangelamerici@yahoo.com. Gracias por su apoyo.",
    intentions:
      "Saturday 5:30 PM \u2014 For the people of the parish\n" +
      "Sunday 9:30 AM \u2014 \u2020 Maria Santos (req. by the family)\n" +
      "Sunday 11:00 AM \u2014 Por la salud de Juan P\u00e9rez",
    pdf_url: ""
  },
  {
    date: "2026-09-20",
    sunday_title: "Twenty-Fifth Sunday in Ordinary Time",
    announcements:
      "Eucharistic Adoration every Thursday at 6:30 PM. Come spend an hour with the Lord.\n" +
      "Adoraci\u00f3n Eucar\u00edstica todos los jueves a las 6:30 PM. Ven a pasar una hora con el Se\u00f1or.\n\n" +
      "Religious Education registrations are open at the parish office, Monday\u2013Friday 9:00 AM\u20136:00 PM.\n" +
      "Inscripciones para la Educaci\u00f3n Religiosa en la oficina parroquial, lunes a viernes de 9:00 AM a 6:00 PM.",
    intentions:
      "Saturday 5:30 PM \u2014 \u2020 Jos\u00e9 Rivera (req. by his wife)\n" +
      "Sunday 11:00 AM \u2014 En acci\u00f3n de gracias por la familia Marte",
    pdf_url: ""
  }
];

(function () {
  "use strict";

  var featuredEl = document.getElementById("bulletin-featured");
  var archiveEl = document.getElementById("bulletin-archive");
  if (!featuredEl || !archiveEl) return;

  function lang() {
    var l = document.documentElement.getAttribute("lang");
    return l && window.I18N && window.I18N[l] ? l : "en";
  }
  function t(key) {
    var dict = (window.I18N && (window.I18N[lang()] || window.I18N.en)) || {};
    return dict[key] || key;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  /* Blank-line separated blocks -> paragraphs; single newlines -> <br>. */
  function richText(s) {
    return esc(s)
      .split(/\n\s*\n/)
      .map(function (block) {
        return "<p>" + block.replace(/\n/g, "<br>") + "</p>";
      })
      .join("");
  }
  function lines(s) {
    return esc(s)
      .split(/\n/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 0; });
  }
  /* Minimal CSV parser: handles quoted fields, commas, and newlines inside quotes. */
  function parseCSV(text) {
    var rows = [], row = [], field = "", inQuotes = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else { field += c; }
      } else if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ignore */ }
      else { field += c; }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function fmtDate(iso) {
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d.getTime())) return iso;
    var locales = { en: "en-US", es: "es-ES", fr: "fr-FR", it: "it-IT", pt: "pt-BR" };
    try {
      return d.toLocaleDateString(locales[lang()] || "en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch (e) { return iso; }
  }
  function dateParts(iso) {
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d.getTime())) return null;
    var locales = { en: "en-US", es: "es-ES", fr: "fr-FR", it: "it-IT", pt: "pt-BR" };
    var loc = locales[lang()] || "en-US";
    try {
      return {
        day: d.toLocaleDateString(loc, { day: "2-digit" }),
        mon: d.toLocaleDateString(loc, { month: "short" }).replace(".", "").toUpperCase(),
        yr: d.toLocaleDateString(loc, { year: "numeric" })
      };
    } catch (e) { return null; }
  }

  function renderFeatured(b) {
    var parts = dateParts(b.date);
    var html = '<article class="bulletin-card">';
    if (parts) {
      html += '<div class="bulletin-date" aria-hidden="true">' +
        '<span class="b-day">' + esc(parts.day) + "</span>" +
        '<span class="b-mon">' + esc(parts.mon) + "</span>" +
        '<span class="b-yr">' + esc(parts.yr) + "</span></div>";
    }
    html += '<p class="bulletin-kicker">' + esc(t("bul.thisweek")) + "</p>";
    html += "<h3>" + esc(b.sunday_title) + "</h3>";
    html += '<p class="bulletin-dateline">' + esc(fmtDate(b.date)) + "</p>";
    if (b.announcements) {
      html += "<h4>" + esc(t("bul.announce")) + "</h4>";
      html += '<div class="bulletin-body">' + richText(b.announcements) + "</div>";
    }
    var intent = lines(b.intentions);
    if (intent.length) {
      html += "<h4>" + esc(t("bul.intent")) + "</h4>";
      html += '<ul class="bulletin-intentions">' +
        intent.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
    }
    if (b.pdf_url) {
      html += '<p><a class="btn" href="' + esc(b.pdf_url) + '" target="_blank" rel="noopener">' +
        esc(t("bul.pdf")) + "</a></p>";
    }
    html += "</article>";
    featuredEl.innerHTML = html;
  }

  function renderArchive(items) {
    if (!items.length) { archiveEl.innerHTML = ""; return; }
    /* Group by year so a decade of bulletins stays easy to browse. */
    var groups = {}, years = [];
    items.forEach(function (b) {
      var y = (/^\d{4}/.test(b.date || "") ? b.date.slice(0, 4) : "????");
      if (!groups[y]) { groups[y] = []; years.push(y); }
      groups[y].push(b);
    });
    years.sort().reverse();
    var html = years.map(function (y, idx) {
      var listHtml = groups[y].map(function (b) {
        var inner = '<span class="archive-date">' + esc(fmtDate(b.date)) + "</span>" +
          '<span class="archive-title">' + esc(b.sunday_title || t("bul.title")) + "</span>";
        if (b.pdf_url) {
          return '<a class="archive-item" href="' + esc(b.pdf_url) + '" target="_blank" rel="noopener">' +
            inner + '<span class="archive-pdf">PDF</span></a>';
        }
        return '<div class="archive-item">' + inner + "</div>";
      }).join("");
      return '<details class="archive-year"' + (idx === 0 ? " open" : "") + ">" +
        "<summary><span>" + esc(y) + "</span>" +
        '<span class="archive-count">' + groups[y].length + "</span></summary>" +
        '<div class="archive-entries">' + listHtml + "</div></details>";
    }).join("");
    archiveEl.innerHTML = html;
  }

  function render(list) {
    if (!list.length) {
      featuredEl.innerHTML = '<p class="bulletin-note">' + esc(t("bul.empty")) + "</p>";
      archiveEl.innerHTML = "";
      return;
    }
    renderFeatured(list[0]);
    renderArchive(list.slice(1).concat(legacyEntries(list)));
  }

  function showLoading() {
    featuredEl.innerHTML = '<p class="bulletin-note">' + esc(t("bul.loading")) + "</p>";
  }
  function showError() {
    featuredEl.innerHTML = '<p class="bulletin-note bulletin-error">' + esc(t("bul.error")) + "</p>";
  }

  function fromRows(rows) {
    var out = [];
    rows.forEach(function (r) {
      var date = (r[0] || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return; // skips header row
      out.push({
        date: date,
        sunday_title: (r[1] || "").trim(),
        announcements: (r[2] || "").trim(),
        intentions: (r[3] || "").trim(),
        pdf_url: (r[4] || "").trim()
      });
    });
    return out;
  }

  /* ---- Historical archive (2015–2026), from bulletin-archive.js ----
     Merged under the newest Sheet entries. Any entry already present in
     the Sheet (same date or same PDF link) is skipped: no duplicates. */
  function archivePdfUrl(iso) {
    return "https://files.ecatholic.com/11134/bulletins/" + iso.replace(/-/g, "") + ".pdf";
  }
  function normUrl(u) {
    return String(u == null ? "" : u).split("?")[0].split("#")[0].trim();
  }
  function legacyEntries(sheetList) {
    var seen = {};
    sheetList.forEach(function (b) {
      if (b.date) seen[b.date] = true;
      var u = normUrl(b.pdf_url);
      if (u) seen[u] = true;
    });
    var out = [];
    (window.BULLETIN_ARCHIVE_DATES || []).forEach(function (d) {
      if (seen[d]) return;
      var u = archivePdfUrl(d);
      if (seen[u]) return;
      out.push({ date: d, sunday_title: "", announcements: "", intentions: "", pdf_url: u });
    });
    return out;
  }

  var current = [];

  function load() {
    showLoading();
    if (!SHEET_CSV_URL) {           // Sheet not connected yet -> sample content
      current = DEMO_BULLETINS.slice();
      render(current);
      return;
    }
    fetch(SHEET_CSV_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        current = fromRows(parseCSV(text));
        render(current);
      })
      .catch(function () {
        showError();
      });
  }

  /* Re-render dates/labels when the visitor switches language. */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".lang-btn") : null;
    if (btn) setTimeout(function () { render(current); }, 0);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
