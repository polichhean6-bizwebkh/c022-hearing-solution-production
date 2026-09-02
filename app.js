/* C022 Hearing Solution Cambodia — Admin Dashboard Demo (V2)
   Single-page app shell over the shared "c022_demo_bookings" dataset.
   No separate datasets per screen — Dashboard, Calendar, Bookings,
   Customers and Reports all read/derive from the same source via
   window.C022Demo (see assets/js/demo-data.js). */
document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  var Demo = window.C022Demo;
  var STATUS_ORDER = window.C022_DEMO_STATUSES;

  var state = {
    view: "dashboard",
    calendarMonth: startOfMonth(new Date()),
    filters: { text: "", status: "" },
    reportPeriod: "last6",
    customRange: null,
    customerSearch: ""
  };

  var charts = { trend: null, visitstatus: null, service: null };
  var currentBookingId = null;

  function dict() {
    return window.C022_DEMO_I18N[Demo.getLang()] || window.C022_DEMO_I18N.en;
  }

  function statusLabel(status) {
    return dict()["status." + status] || status;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function fmtISO(d) { return Demo.fmtDate(d); }
  function todayISO() { return fmtISO(new Date()); }

  /* ================= LANGUAGE ================= */
  function applyLang(lang) {
    document.documentElement.setAttribute("lang", lang === "kh" ? "km" : "en");
    document.documentElement.setAttribute("data-lang", lang);
    document.body.classList.toggle("lang-kh", lang === "kh");
    document.body.classList.toggle("lang-en", lang !== "kh");
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang-btn") === lang);
    });
    var d = dict();
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (d[key] !== undefined) el.textContent = d[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (d[key] !== undefined) el.setAttribute("placeholder", d[key]);
    });
    populateStatusFilter();
    populateStatusSelect(document.getElementById("d-status"));
    renderAll();
  }

  document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var lang = btn.getAttribute("data-lang-btn");
      Demo.setLang(lang);
      applyLang(lang);
    });
  });

  window.addEventListener("storage", function (e) {
    if (e.key === Demo.LANG_KEY) applyLang(Demo.getLang());
    if (e.key === Demo.BOOKINGS_KEY) renderAll();
  });

  /* ================= NAVIGATION ================= */
  function switchView(name) {
    state.view = name;
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.toggle("is-active", v.id === "view-" + name);
    });
    document.querySelectorAll("[data-view-link]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-view-link") === name);
    });
    closeDrawer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-view-link]").forEach(function (btn) {
    btn.addEventListener("click", function () { switchView(btn.getAttribute("data-view-link")); });
  });

  function openDrawer() {
    document.getElementById("sidebar").classList.add("is-open");
    document.getElementById("sidebar-overlay").classList.add("is-open");
  }
  function closeDrawer() {
    document.getElementById("sidebar").classList.remove("is-open");
    document.getElementById("sidebar-overlay").classList.remove("is-open");
  }
  document.getElementById("menu-toggle").addEventListener("click", openDrawer);
  document.getElementById("sidebar-overlay").addEventListener("click", closeDrawer);

  /* ================= SHARED SELECT/FILTER POPULATION ================= */
  function populateStatusFilter() {
    var d = dict();
    var sel = document.getElementById("status-filter");
    var prev = sel.value;
    sel.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = d["dash.filterAll"];
    sel.appendChild(all);
    STATUS_ORDER.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = d["status." + s] || s;
      sel.appendChild(opt);
    });
    sel.value = prev || "";
  }

  function populateStatusSelect(sel) {
    var d = dict();
    sel.innerHTML = "";
    STATUS_ORDER.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = d["status." + s] || s;
      sel.appendChild(opt);
    });
  }

  document.getElementById("search").addEventListener("input", function (e) { state.filters.text = e.target.value; renderBookings(); });
  document.getElementById("status-filter").addEventListener("change", function (e) { state.filters.status = e.target.value; renderBookings(); });
  document.getElementById("clear-filters").addEventListener("click", function () {
    state.filters = { text: "", status: "" };
    document.getElementById("search").value = "";
    document.getElementById("status-filter").value = "";
    renderBookings();
  });

  /* ================= RENDER: DASHBOARD OVERVIEW ================= */
  function renderDashboardOverview() {
    var list = Demo.getBookings();
    var today = todayISO();
    document.getElementById("kpi-total").textContent = list.length;
    document.getElementById("kpi-today").textContent = list.filter(function (b) { return b.date === today; }).length;
    document.getElementById("kpi-pending").textContent = list.filter(function (b) { return b.status === "Pending"; }).length;
    document.getElementById("kpi-confirmed").textContent = list.filter(function (b) { return b.status === "Confirmed"; }).length;
    document.getElementById("kpi-completed").textContent = list.filter(function (b) { return b.status === "Completed"; }).length;
    document.getElementById("kpi-cancelled").textContent = list.filter(function (b) { return b.status === "Cancelled"; }).length;
    document.getElementById("kpi-patients").textContent = Demo.getCustomers().length;

    var d = dict();
    var upcoming = list
      .filter(function (b) { return b.date >= today && b.status !== "Cancelled" && b.status !== "Completed"; })
      .sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); })
      .slice(0, 6);
    var upcomingEl = document.getElementById("upcoming-list");
    upcomingEl.innerHTML = upcoming.length ? "" : '<li class="mini-sub">' + d["ov.noUpcoming"] + "</li>";
    upcoming.forEach(function (b) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span><span class="mini-main">' + escapeHtml(b.customerName) + '</span><br><span class="mini-sub">' +
        escapeHtml(b.service) + " · " + escapeHtml(b.date) + " " + escapeHtml(b.time) + "</span></span>" +
        '<span class="status-badge status-' + b.status.replace(/\s/g, "-") + '">' + escapeHtml(statusLabel(b.status)) + "</span>";
      upcomingEl.appendChild(li);
    });

    var recent = list.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 6);
    var activityEl = document.getElementById("activity-list");
    activityEl.innerHTML = recent.length ? "" : '<li class="mini-sub">' + d["ov.noActivity"] + "</li>";
    recent.forEach(function (b) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span><span class="mini-main">' + escapeHtml(b.customerName) + '</span><br><span class="mini-sub">' +
        escapeHtml(b.reference) + " · " + new Date(b.createdAt).toLocaleDateString() + "</span></span>" +
        '<span class="status-badge status-' + b.status.replace(/\s/g, "-") + '">' + escapeHtml(statusLabel(b.status)) + "</span>";
      activityEl.appendChild(li);
    });
  }

  /* ================= RENDER: CALENDAR ================= */
  var DOW_KEYS = ["cal.mon", "cal.tue", "cal.wed", "cal.thu", "cal.fri", "cal.sat", "cal.sun"];

  function renderCalendarDow() {
    var d = dict();
    var wrap = document.getElementById("calendar-dow");
    wrap.innerHTML = "";
    DOW_KEYS.forEach(function (k) {
      var el = document.createElement("div");
      el.className = "calendar-dow";
      el.textContent = d[k];
      wrap.appendChild(el);
    });
  }

  function renderCalendar() {
    var d = dict();
    var month = state.calendarMonth;
    document.getElementById("calendar-month-label").textContent =
      month.toLocaleDateString(Demo.getLang() === "kh" ? "en-GB" : undefined, { month: "long", year: "numeric" });

    var list = Demo.getBookings();
    var byDate = {};
    list.forEach(function (b) {
      if (!byDate[b.date]) byDate[b.date] = [];
      byDate[b.date].push(b);
    });

    var firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    var jsDow = firstOfMonth.getDay(); // 0=Sun..6=Sat
    var mondayOffset = (jsDow + 6) % 7; // 0 = Monday
    var gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - mondayOffset);

    var today = todayISO();
    var grid = document.getElementById("calendar-grid");
    grid.innerHTML = "";

    for (var i = 0; i < 42; i++) {
      var cellDate = new Date(gridStart);
      cellDate.setDate(cellDate.getDate() + i);
      var iso = fmtISO(cellDate);
      var isOutside = cellDate.getMonth() !== month.getMonth();
      var cell = document.createElement("div");
      cell.className = "calendar-cell" + (isOutside ? " is-outside" : "") + (iso === today ? " is-today" : "");
      var dayBookings = byDate[iso] || [];
      var chipsHtml = dayBookings.slice(0, 2).map(function (b) {
        return '<span class="calendar-chip chip-' + b.status.replace(/\s/g, "-") + '">' + escapeHtml(b.time) + " " + escapeHtml(b.customerName.split(" ")[0]) + "</span>";
      }).join("");
      var moreHtml = dayBookings.length > 2 ? '<span class="calendar-more">+' + (dayBookings.length - 2) + " " + d["cal.more"] + "</span>" : "";
      cell.innerHTML = '<span class="calendar-daynum">' + cellDate.getDate() + "</span>" + chipsHtml + moreHtml;
      cell.addEventListener("click", function (iso2) {
        return function () { openDayModal(iso2); };
      }(iso));
      grid.appendChild(cell);
    }
  }

  function openDayModal(iso) {
    var d = dict();
    var list = Demo.getBookings().filter(function (b) { return b.date === iso; })
      .sort(function (a, b) { return a.time.localeCompare(b.time); });
    document.getElementById("day-modal-date").textContent = iso;
    var wrap = document.getElementById("day-modal-list");
    wrap.innerHTML = list.length ? "" : '<li class="mini-sub">' + d["cal.noBookings"] + "</li>";
    list.forEach(function (b) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span><span class="mini-main">' + escapeHtml(b.time) + " — " + escapeHtml(b.customerName) + '</span><br><span class="mini-sub">' +
        escapeHtml(b.service) + "</span></span>" +
        '<span class="status-badge status-' + b.status.replace(/\s/g, "-") + '">' + escapeHtml(statusLabel(b.status)) + "</span>";
      wrap.appendChild(li);
    });
    document.getElementById("day-modal").classList.add("is-open");
  }
  document.getElementById("day-close").addEventListener("click", function () {
    document.getElementById("day-modal").classList.remove("is-open");
  });
  document.getElementById("day-modal").addEventListener("click", function (e) {
    if (e.target.id === "day-modal") document.getElementById("day-modal").classList.remove("is-open");
  });

  document.getElementById("cal-prev").addEventListener("click", function () {
    state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById("cal-next").addEventListener("click", function () {
    state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  document.getElementById("cal-today").addEventListener("click", function () {
    state.calendarMonth = startOfMonth(new Date());
    renderCalendar();
  });

  /* ================= RENDER: BOOKINGS ================= */
  function renderBookings() {
    var d = dict();
    var list = Demo.getBookings().slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    var q = state.filters.text.trim().toLowerCase();

    var filtered = list.filter(function (b) {
      var matchesText = !q ||
        (b.customerName || "").toLowerCase().indexOf(q) >= 0 ||
        (b.phone || "").toLowerCase().indexOf(q) >= 0 ||
        (b.reference || "").toLowerCase().indexOf(q) >= 0;
      var matchesStatus = !state.filters.status || b.status === state.filters.status;
      return matchesText && matchesStatus;
    });

    var tbody = document.getElementById("booking-rows");
    tbody.innerHTML = "";
    filtered.forEach(function (b) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(b.reference) + "</td>" +
        "<td>" + escapeHtml(b.customerName) + "</td>" +
        "<td>" + escapeHtml(b.phone) + "</td>" +
        "<td>" + escapeHtml(b.service) + "</td>" +
        '<td class="col-date">' + escapeHtml(b.date) + " " + escapeHtml(b.time) + "</td>" +
        "<td>" + escapeHtml(b.source) + "</td>" +
        '<td><span class="status-badge status-' + b.status.replace(/\s/g, "-") + '">' + escapeHtml(statusLabel(b.status)) + "</span></td>" +
        '<td><button type="button" class="link-btn" data-view-booking="' + b.id + '">' + d["dash.view"] + "</button></td>";
      tbody.appendChild(tr);
    });

    document.getElementById("empty-state").hidden = filtered.length > 0;
    document.getElementById("empty-state").querySelector("strong").textContent = list.length === 0 ? d["dash.emptyAll"] : d["dash.empty"];
    document.querySelector("#view-bookings .table").hidden = filtered.length === 0;

    tbody.querySelectorAll("[data-view-booking]").forEach(function (btn) {
      btn.addEventListener("click", function () { openBookingDetail(btn.getAttribute("data-view-booking")); });
    });
  }

  function openBookingDetail(id) {
    var b = Demo.getBookings().filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    currentBookingId = id;
    var d = dict();
    document.getElementById("d-reference").textContent = b.reference;
    document.getElementById("d-name").textContent = b.customerName;
    document.getElementById("d-phone").textContent = b.phone;
    document.getElementById("d-service").textContent = b.service;
    document.getElementById("d-datetime").textContent = b.date + " " + b.time;
    document.getElementById("d-source").textContent = b.source;
    document.getElementById("d-message").textContent = b.message || d["review.none"];
    document.getElementById("d-created").textContent = new Date(b.createdAt).toLocaleString();
    document.getElementById("d-status").value = b.status;
    document.getElementById("d-note").value = b.adminNote || "";
    document.getElementById("d-saved").hidden = true;

    var historyEl = document.getElementById("d-history");
    historyEl.innerHTML = "";
    (b.history || []).forEach(function (h) {
      var li = document.createElement("li");
      li.textContent = statusLabel(h.status) + " — " + new Date(h.at).toLocaleString();
      historyEl.appendChild(li);
    });

    document.getElementById("detail-modal").classList.add("is-open");
  }

  function closeDetail() {
    document.getElementById("detail-modal").classList.remove("is-open");
    currentBookingId = null;
  }
  document.getElementById("detail-close").addEventListener("click", closeDetail);
  document.getElementById("detail-modal").addEventListener("click", function (e) {
    if (e.target.id === "detail-modal") closeDetail();
  });

  function refreshDetailHistory(id) {
    var b = Demo.getBookings().filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    var historyEl = document.getElementById("d-history");
    historyEl.innerHTML = "";
    (b.history || []).forEach(function (h) {
      var li = document.createElement("li");
      li.textContent = statusLabel(h.status) + " — " + new Date(h.at).toLocaleString();
      historyEl.appendChild(li);
    });
  }

  document.getElementById("d-save").addEventListener("click", async function () {
    if (!currentBookingId) return;
    var saveBtn = document.getElementById("d-save");
    var savedMsg = document.getElementById("d-saved");
    var errorMsg = document.getElementById("d-save-error");
    var patch = {
      status: document.getElementById("d-status").value,
      adminNote: document.getElementById("d-note").value
    };
    savedMsg.hidden = true;
    errorMsg.hidden = true;
    saveBtn.disabled = true;
    try {
      await Demo.updateBooking(currentBookingId, patch);
      renderAll();
      // Refresh only the history list (not the whole form) so the "Saved."
      // confirmation stays visible instead of being reset by a full reopen.
      refreshDetailHistory(currentBookingId);
      savedMsg.hidden = false;
    } catch (err) {
      console.error("Failed to save booking:", err);
      errorMsg.hidden = false;
    } finally {
      saveBtn.disabled = false;
    }
  });

  /* ================= RENDER: CUSTOMERS ================= */
  function renderCustomers() {
    var d = dict();
    var customers = Demo.getCustomers();
    var q = state.customerSearch.trim().toLowerCase();
    var filtered = customers.filter(function (c) {
      return !q || (c.name || "").toLowerCase().indexOf(q) >= 0 || (c.phone || "").toLowerCase().indexOf(q) >= 0;
    });

    var tbody = document.getElementById("customer-rows");
    tbody.innerHTML = "";
    filtered.forEach(function (c) {
      var tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.innerHTML =
        "<td>" + escapeHtml(c.name) + "</td>" +
        "<td>" + escapeHtml(c.phone) + "</td>" +
        "<td>" + c.totalVisits + "</td>" +
        "<td>" + escapeHtml(c.lastVisit) + "</td>" +
        "<td>" + escapeHtml(c.mostUsedService) + "</td>" +
        '<td><span class="status-badge status-' + (c.latestStatus || "").replace(/\s/g, "-") + '">' + escapeHtml(statusLabel(c.latestStatus)) + "</span></td>";
      tr.addEventListener("click", function () { openCustomerDetail(c); });
      tbody.appendChild(tr);
    });

    document.getElementById("customer-empty").hidden = filtered.length > 0;
    document.querySelector("#view-customers .table").hidden = filtered.length === 0;
  }

  function openCustomerDetail(c) {
    document.getElementById("cust-modal-name").textContent = c.name;
    document.getElementById("cust-modal-phone").textContent = c.phone;
    var wrap = document.getElementById("cust-modal-list");
    wrap.innerHTML = "";
    c.bookings.forEach(function (b) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span><span class="mini-main">' + escapeHtml(b.date) + " " + escapeHtml(b.time) + '</span><br><span class="mini-sub">' +
        escapeHtml(b.service) + " · " + escapeHtml(b.reference) + "</span></span>" +
        '<span class="status-badge status-' + b.status.replace(/\s/g, "-") + '">' + escapeHtml(statusLabel(b.status)) + "</span>";
      wrap.appendChild(li);
    });
    document.getElementById("customer-modal").classList.add("is-open");
  }
  document.getElementById("customer-close").addEventListener("click", function () {
    document.getElementById("customer-modal").classList.remove("is-open");
  });
  document.getElementById("customer-modal").addEventListener("click", function (e) {
    if (e.target.id === "customer-modal") document.getElementById("customer-modal").classList.remove("is-open");
  });
  document.getElementById("customer-search").addEventListener("input", function (e) {
    state.customerSearch = e.target.value;
    renderCustomers();
  });

  /* ================= RENDER: REPORTS ================= */
  var CHART_COLORS = ["#1746c8", "#f59a00", "#4d7de0", "#7fa3ea", "#1a7f5a", "#61708a"];

  function resolvePeriod() {
    if (state.reportPeriod === "custom" && state.customRange) return state.customRange;
    return Demo.periodRange(state.reportPeriod);
  }

  document.querySelectorAll(".period-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var preset = btn.getAttribute("data-period");
      state.reportPeriod = preset;
      document.querySelectorAll(".period-btn").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      var customWrap = document.getElementById("period-custom");
      if (preset === "custom") {
        customWrap.hidden = false;
        var r = resolvePeriod();
        document.getElementById("period-from").value = r.start;
        document.getElementById("period-to").value = r.end;
      } else {
        customWrap.hidden = true;
        renderReports();
      }
    });
  });
  document.getElementById("period-apply").addEventListener("click", function () {
    var from = document.getElementById("period-from").value;
    var to = document.getElementById("period-to").value;
    if (!from || !to || from > to) return;
    state.customRange = { start: from, end: to };
    renderReports();
  });

  function renderReports() {
    var d = dict();
    var range = resolvePeriod();
    var r = Demo.getReportData(range.start, range.end);

    document.getElementById("rep-total").textContent = r.totalBookings;
    document.getElementById("rep-patients").textContent = r.uniquePatients;
    document.getElementById("rep-visits").textContent = r.totalVisits;
    document.getElementById("rep-completed").textContent = r.completedVisits;
    document.getElementById("rep-cancelled").textContent = r.cancelledBookings;
    document.getElementById("rep-noshow").textContent = r.noShow;
    document.getElementById("rep-new").textContent = r.newPatients;
    document.getElementById("rep-returning").textContent = r.returningPatients;
    document.getElementById("rep-unique").textContent = r.uniquePatients;
    document.getElementById("rep-new2").textContent = r.newPatients;
    document.getElementById("rep-returning2").textContent = r.returningPatients;
    document.getElementById("rep-avg").textContent = r.avgVisitsPerPatient;

    var serviceRows = document.getElementById("service-rows");
    serviceRows.innerHTML = "";
    if (!r.serviceBreakdown.length) {
      var tr0 = document.createElement("tr");
      tr0.innerHTML = '<td colspan="5" class="muted">' + d["rep.noData"] + "</td>";
      serviceRows.appendChild(tr0);
    }
    r.serviceBreakdown.forEach(function (s) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(s.service) + "</td>" +
        "<td>" + s.bookings + "</td>" +
        "<td>" + s.patients + "</td>" +
        "<td>" + s.completed + "</td>" +
        "<td>" + s.percentage + "%</td>";
      serviceRows.appendChild(tr);
    });

    var repeatList = document.getElementById("top-repeat-list");
    repeatList.innerHTML = r.topRepeatPatients.length ? "" : '<li class="mini-sub">' + d["rep.noData"] + "</li>";
    r.topRepeatPatients.forEach(function (c) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span><span class="mini-main">' + escapeHtml(c.name) + '</span><br><span class="mini-sub">' + escapeHtml(c.phone) + "</span></span>" +
        "<span>" + c.totalVisits + "</span>";
      repeatList.appendChild(li);
    });

    renderCharts(r, d);
  }

  function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
  }

  function renderCharts(r, d) {
    if (typeof Chart === "undefined") return; // CDN unavailable — KPI cards/tables above still fully work.

    destroyChart("trend");
    var trendCtx = document.getElementById("chart-trend");
    if (trendCtx) {
      charts.trend = new Chart(trendCtx, {
        type: "bar",
        data: {
          labels: r.trend.map(function (t) { return t.label; }),
          datasets: [{ label: d["rep.trendTitle"], data: r.trend.map(function (t) { return t.count; }), backgroundColor: "#1746c8", borderRadius: 6, maxBarThickness: 40 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grid: { color: "#e8eefc" } }, x: { grid: { display: false } } }
        }
      });
    }

    destroyChart("visitstatus");
    var vsCtx = document.getElementById("chart-visitstatus");
    if (vsCtx) {
      var vsLabels = Object.keys(r.visitStatus);
      charts.visitstatus = new Chart(vsCtx, {
        type: "bar",
        data: {
          labels: vsLabels.map(function (s) { return d["status." + s] || s; }),
          datasets: [{ label: d["rep.visitStatusTitle"], data: vsLabels.map(function (s) { return r.visitStatus[s]; }), backgroundColor: CHART_COLORS, borderRadius: 6, maxBarThickness: 40 }]
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, grid: { color: "#e8eefc" } }, y: { grid: { display: false } } }
        }
      });
    }

    destroyChart("service");
    var svcCtx = document.getElementById("chart-service");
    if (svcCtx) {
      var top = r.serviceBreakdown.slice(0, 6);
      charts.service = new Chart(svcCtx, {
        type: "doughnut",
        data: {
          labels: top.map(function (s) { return s.service; }),
          datasets: [{ data: top.map(function (s) { return s.bookings; }), backgroundColor: CHART_COLORS }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } }
        }
      });
    }
  }

  /* ================= INIT ================= */
  function renderAll() {
    renderDashboardOverview();
    renderCalendarDow();
    renderCalendar();
    renderBookings();
    renderCustomers();
    renderReports();
  }

  /* ================= AUTH (Supabase email/password) ================= */
  var Auth = window.C022Auth;
  var loginScreen = document.getElementById("login-screen");
  var appShell = document.getElementById("app-shell");
  var loginForm = document.getElementById("login-form");
  var loginError = document.getElementById("login-error");
  var loginSubmit = document.getElementById("login-submit");

  async function showDashboard() {
    loginScreen.classList.remove("is-open");
    loginScreen.style.display = "none";
    appShell.style.display = "flex";
    try {
      await Demo.fetchBookings();
    } catch (err) {
      console.error("Failed to load bookings:", err);
    }
    applyLang(Demo.getLang());
    switchView("dashboard");
  }

  function showLogin() {
    appShell.style.display = "none";
    loginScreen.style.display = "";
    loginScreen.classList.add("is-open");
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    loginError.hidden = true;
    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;
    if (!email || !password) return;

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Signing in…";
    try {
      var res = await Auth.signIn(email, password);
      if (res.error) {
        loginError.textContent = "Incorrect email or password.";
        loginError.hidden = false;
      } else {
        await showDashboard();
      }
    } catch (err) {
      loginError.textContent = "Something went wrong. Please try again.";
      loginError.hidden = false;
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = "Sign In";
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async function () {
    await Auth.signOut();
    showLogin();
  });

  /* ================= FORGOT / RESET PASSWORD ================= */
  var forgotModal = document.getElementById("forgot-password-modal");
  var forgotForm = document.getElementById("forgot-form");
  var forgotEmail = document.getElementById("forgot-email");
  var forgotError = document.getElementById("forgot-error");
  var forgotSuccess = document.getElementById("forgot-success");
  var forgotSubmit = document.getElementById("forgot-submit");
  var forgotLink = document.getElementById("forgot-password-link");
  var forgotClose = document.getElementById("forgot-close");

  var resetModal = document.getElementById("reset-password-modal");
  var resetForm = document.getElementById("reset-form");
  var resetPw1 = document.getElementById("reset-password-1");
  var resetPw2 = document.getElementById("reset-password-2");
  var resetError = document.getElementById("reset-error");
  var resetSuccess = document.getElementById("reset-success");
  var resetSubmit = document.getElementById("reset-submit");
  var resetCancel = document.getElementById("reset-cancel");

  function openForgotModal() {
    loginScreen.style.display = "none";
    forgotError.hidden = true;
    forgotSuccess.hidden = true;
    forgotForm.hidden = false;
    forgotEmail.value = "";
    forgotSubmit.disabled = false;
    forgotSubmit.textContent = "Send Reset Link";
    forgotModal.classList.add("is-open");
    forgotModal.style.display = "flex";
  }
  function closeForgotModal() {
    forgotModal.classList.remove("is-open");
    forgotModal.style.display = "none";
    loginScreen.style.display = "";
  }

  forgotLink.addEventListener("click", openForgotModal);
  forgotClose.addEventListener("click", closeForgotModal);

  forgotForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    forgotError.hidden = true;
    forgotSuccess.hidden = true;
    var email = forgotEmail.value.trim();
    if (!email) return;

    forgotSubmit.disabled = true;
    forgotSubmit.textContent = "Sending…";
    try {
      await Auth.resetPasswordForEmail(email);
    } catch (err) {
      // Swallow the error detail — never reveal whether an account exists
      // for this email. The generic message below is shown either way.
    }
    forgotForm.hidden = true;
    forgotSuccess.textContent = "If an account exists for this email, a password reset link has been sent.";
    forgotSuccess.hidden = false;
  });

  function isRecoveryLink() {
    return /type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search);
  }

  function cleanRecoveryParamsFromUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function openResetModal() {
    loginScreen.style.display = "none";
    forgotModal.style.display = "none";
    forgotModal.classList.remove("is-open");
    appShell.style.display = "none";
    resetError.hidden = true;
    resetSuccess.hidden = true;
    resetForm.hidden = false;
    resetPw1.value = "";
    resetPw2.value = "";
    resetPw1.type = "password";
    resetPw2.type = "password";
    document.getElementById("toggle-pw-1").textContent = "Show";
    document.getElementById("toggle-pw-2").textContent = "Show";
    resetSubmit.disabled = false;
    resetSubmit.textContent = "Update Password";
    resetModal.classList.add("is-open");
    resetModal.style.display = "flex";
  }

  function closeResetModalToLogin() {
    resetModal.classList.remove("is-open");
    resetModal.style.display = "none";
    cleanRecoveryParamsFromUrl();
    showLogin();
  }

  resetForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    resetError.hidden = true;
    var pw1 = resetPw1.value;
    var pw2 = resetPw2.value;
    if (pw1.length < 8) {
      resetError.textContent = "Password must be at least 8 characters.";
      resetError.hidden = false;
      return;
    }
    if (pw1 !== pw2) {
      resetError.textContent = "Passwords do not match.";
      resetError.hidden = false;
      return;
    }

    resetSubmit.disabled = true;
    resetSubmit.textContent = "Updating…";
    try {
      var res = await Auth.updateUserPassword(pw1);
      if (res.error) {
        resetError.textContent = "Could not update password. Please request a new reset link.";
        resetError.hidden = false;
        resetSubmit.disabled = false;
        resetSubmit.textContent = "Update Password";
        return;
      }
      resetForm.hidden = true;
      resetSuccess.textContent = "Your password has been updated. Please sign in with your new password.";
      resetSuccess.hidden = false;
      await Auth.signOut();
      setTimeout(closeResetModalToLogin, 2500);
    } catch (err) {
      resetError.textContent = "Something went wrong. Please try again.";
      resetError.hidden = false;
      resetSubmit.disabled = false;
      resetSubmit.textContent = "Update Password";
    }
  });

  resetCancel.addEventListener("click", async function () {
    await Auth.signOut();
    closeResetModalToLogin();
  });

  function wireShowHide(btnId, inputId) {
    var btn = document.getElementById(btnId);
    var input = document.getElementById(inputId);
    btn.addEventListener("click", function () {
      var isPw = input.type === "password";
      input.type = isPw ? "text" : "password";
      btn.textContent = isPw ? "Hide" : "Show";
    });
  }
  wireShowHide("toggle-pw-1", "reset-password-1");
  wireShowHide("toggle-pw-2", "reset-password-2");

  Auth.onAuthStateChange(function (event) {
    if (event === "PASSWORD_RECOVERY") {
      openResetModal();
    } else if (event === "SIGNED_OUT") {
      showLogin();
    }
  });

  (async function initAuthGate() {
    if (isRecoveryLink()) {
      // A password-recovery link is being processed. Don't auto-open the
      // dashboard — wait for the PASSWORD_RECOVERY auth event above, which
      // opens the Reset Password screen instead.
      loginScreen.style.display = "none";
      return;
    }
    var session = await Auth.getSession();
    if (session) {
      await showDashboard();
    } else {
      showLogin();
    }
  })();
});
