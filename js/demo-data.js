/* C022 Hearing Solution Cambodia — Static Client Demo
   Shared demo data layer (localStorage only, no backend).
   Used by booking/index.html and dashboard/index.html so bookings
   submitted on the public booking demo appear immediately in the
   dashboard demo, and vice versa. Also powers the dashboard's
   Calendar, Customers and Reports views — all derived from the SAME
   "c022_demo_bookings" localStorage array (no separate datasets). */
(function (global) {
  "use strict";

  var LANG_KEY = "c022Language";
  var BOOKINGS_KEY = "c022_demo_bookings";
  var INIT_KEY = "c022_demo_initialized";

  function getLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      return v === "kh" ? "kh" : "en";
    } catch (e) {
      return "en";
    }
  }

  function setLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang === "kh" ? "kh" : "en");
    } catch (e) {}
  }

  function readBookings() {
    try {
      var raw = localStorage.getItem(BOOKINGS_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeBookings(list) {
    try {
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function pad(n, len) {
    n = String(n);
    while (n.length < len) n = "0" + n;
    return n;
  }

  function dateStamp(d) {
    d = d || new Date();
    return "" + d.getFullYear() + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2);
  }

  function fmtDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }

  function nextReference(list, now) {
    var stamp = dateStamp(now);
    var prefix = "HS-" + stamp + "-";
    var count = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].reference && list[i].reference.indexOf(prefix) === 0) count++;
    }
    return prefix + pad(count + 1, 3);
  }

  function uid() {
    return "b_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Adds a booking record and returns the stored record (with id/reference/createdAt). */
  function addBooking(fields) {
    var list = readBookings();
    var now = new Date();
    var record = {
      id: uid(),
      reference: nextReference(list, now),
      customerName: fields.customerName || "",
      phone: fields.phone || "",
      service: fields.service || "",
      // Customers no longer choose a specialist during booking. New bookings
      // are created unassigned; admin assigns a specialist later from the
      // dashboard. `fields.specialist` may still be passed by internal/seed
      // code (e.g. to represent an admin-assigned specialist on sample data).
      specialist: fields.specialist === undefined ? null : fields.specialist,
      date: fields.date || "",
      time: fields.time || "",
      message: fields.message || "",
      source: fields.source || "Website",
      status: fields.status || "Pending",
      adminNote: fields.adminNote || "",
      history: fields.history || [{ status: fields.status || "Pending", at: (fields.createdAt || now.toISOString()) }],
      createdAt: fields.createdAt || now.toISOString()
    };
    list.push(record);
    writeBookings(list);
    return record;
  }

  function updateBooking(id, patch) {
    var list = readBookings();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        var prevStatus = list[i].status;
        list[i] = Object.assign({}, list[i], patch);
        if (patch.status && patch.status !== prevStatus) {
          list[i].history = (list[i].history || []).concat([
            { status: patch.status, at: new Date().toISOString() }
          ]);
        }
        writeBookings(list);
        return list[i];
      }
    }
    return null;
  }

  /** Guards against an accidental double-submit of the exact same request within a short window. */
  function isDuplicate(fields) {
    var list = readBookings();
    var now = Date.now();
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (
        b.phone === fields.phone &&
        b.service === fields.service &&
        b.date === fields.date &&
        b.time === fields.time &&
        now - new Date(b.createdAt).getTime() < 15000
      ) {
        return true;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------------
     Derived views — Customers and Reports never keep their own copy of
     the data; they always recompute from readBookings() on demand.
     ------------------------------------------------------------------ */

  /** One row per unique customer (grouped by phone), for the Customers page. */
  function getCustomers() {
    var list = readBookings();
    var byPhone = {};
    var order = [];
    list.forEach(function (b) {
      var key = b.phone || b.customerName;
      if (!byPhone[key]) {
        byPhone[key] = { name: b.customerName, phone: b.phone, bookings: [] };
        order.push(key);
      }
      byPhone[key].bookings.push(b);
      // Prefer the most recently seen name spelling for display.
      if (new Date(b.createdAt) >= new Date(byPhone[key].bookings[0].createdAt)) {
        byPhone[key].name = b.customerName || byPhone[key].name;
      }
    });
    return order.map(function (key) {
      var c = byPhone[key];
      var sorted = c.bookings.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      var serviceCounts = {};
      c.bookings.forEach(function (b) { serviceCounts[b.service] = (serviceCounts[b.service] || 0) + 1; });
      var mostUsedService = Object.keys(serviceCounts).sort(function (a, b) { return serviceCounts[b] - serviceCounts[a]; })[0] || "—";
      return {
        name: c.name,
        phone: c.phone,
        totalVisits: c.bookings.length,
        lastVisit: sorted[0] ? sorted[0].date : "",
        mostUsedService: mostUsedService,
        latestStatus: sorted[0] ? sorted[0].status : "",
        bookings: c.bookings.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
      };
    }).sort(function (a, b) { return new Date(b.lastVisit) - new Date(a.lastVisit); });
  }

  /**
   * Report data for a date range (inclusive), based on each booking's
   * appointment date (b.date), which represents the actual visit.
   * start/end are "YYYY-MM-DD" strings.
   */
  function getReportData(start, end) {
    var list = readBookings();
    var startD = new Date(start + "T00:00:00");
    var endD = new Date(end + "T23:59:59");

    function inRange(b) {
      var d = new Date(b.date + "T12:00:00");
      return d >= startD && d <= endD;
    }

    var inPeriod = list.filter(inRange);

    // First-ever booking date per customer (across ALL bookings, not just this period).
    var firstBookingByPhone = {};
    list.forEach(function (b) {
      var key = b.phone || b.customerName;
      var d = b.date;
      if (!firstBookingByPhone[key] || d < firstBookingByPhone[key]) firstBookingByPhone[key] = d;
    });

    var patientsInPeriod = {};
    inPeriod.forEach(function (b) { patientsInPeriod[b.phone || b.customerName] = true; });
    var uniquePatients = Object.keys(patientsInPeriod);

    var newPatients = uniquePatients.filter(function (key) {
      var first = firstBookingByPhone[key];
      return first >= start && first <= end;
    });
    var returningPatients = uniquePatients.filter(function (key) {
      return newPatients.indexOf(key) === -1;
    });

    function countStatus(s) { return inPeriod.filter(function (b) { return b.status === s; }).length; }

    // Service breakdown
    var serviceMap = {};
    inPeriod.forEach(function (b) {
      if (!serviceMap[b.service]) serviceMap[b.service] = { bookings: 0, patients: {}, completed: 0 };
      serviceMap[b.service].bookings++;
      serviceMap[b.service].patients[b.phone || b.customerName] = true;
      if (b.status === "Completed") serviceMap[b.service].completed++;
    });
    var totalForPct = inPeriod.length || 1;
    var serviceBreakdown = Object.keys(serviceMap).map(function (svc) {
      var s = serviceMap[svc];
      return {
        service: svc,
        bookings: s.bookings,
        patients: Object.keys(s.patients).length,
        completed: s.completed,
        percentage: Math.round((s.bookings / totalForPct) * 1000) / 10
      };
    }).sort(function (a, b) { return b.bookings - a.bookings; });

    // Fixed 6-month trend, independent of the selected period (per spec item L).
    var trend = [];
    var now = new Date();
    for (var i = 5; i >= 0; i--) {
      var m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var monthKey = m.getFullYear() + "-" + pad(m.getMonth() + 1, 2);
      var count = list.filter(function (b) { return (b.date || "").slice(0, 7) === monthKey; }).length;
      trend.push({ label: m.toLocaleDateString(undefined, { month: "short" }), monthKey: monthKey, count: count });
    }

    return {
      start: start,
      end: end,
      totalBookings: inPeriod.length,
      uniquePatients: uniquePatients.length,
      totalVisits: inPeriod.length,
      completedVisits: countStatus("Completed"),
      cancelledBookings: countStatus("Cancelled"),
      noShow: countStatus("No-show"),
      newPatients: newPatients.length,
      returningPatients: returningPatients.length,
      serviceBreakdown: serviceBreakdown,
      trend: trend,
      visitStatus: {
        Completed: countStatus("Completed"),
        Confirmed: countStatus("Confirmed"),
        Pending: countStatus("Pending"),
        Contacted: countStatus("Contacted"),
        Cancelled: countStatus("Cancelled"),
        "No-show": countStatus("No-show")
      },
      avgVisitsPerPatient: uniquePatients.length ? Math.round((inPeriod.length / uniquePatients.length) * 10) / 10 : 0,
      topRepeatPatients: getCustomers()
        .filter(function (c) { return patientsInPeriod[c.phone || c.name]; })
        .sort(function (a, b) { return b.totalVisits - a.totalVisits; })
        .slice(0, 5)
    };
  }

  /** Helper for report period presets. Returns {start, end} as YYYY-MM-DD. */
  function periodRange(preset) {
    var now = new Date();
    var end = fmtDate(now);
    var start;
    if (preset === "thisMonth") {
      start = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
    } else if (preset === "last3") {
      start = fmtDate(new Date(now.getFullYear(), now.getMonth() - 2, 1));
    } else {
      start = fmtDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    }
    return { start: start, end: end };
  }

  /* ------------------------------------------------------------------
     Seed data — generates a realistic 6-month dataset (~70-90 bookings)
     the first time the demo is opened, so the Calendar, Customers and
     Reports views have enough data to look like a real clinic. New
     customer submissions are added on top and never overwritten.
     ------------------------------------------------------------------ */
  function seedIfNeeded() {
    try {
      if (localStorage.getItem(INIT_KEY) === "1") return;
    } catch (e) {
      return;
    }
    var existing = readBookings();
    if (existing.length === 0) {
      generateSeedData().forEach(function (s) { addBooking(s); });
    }
    try {
      localStorage.setItem(INIT_KEY, "1");
    } catch (e) {}
  }

  // Small deterministic PRNG so demo data looks the same across visits/tests.
  function makeRng(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function generateSeedData() {
    var rng = makeRng(42);
    function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
    function chance(p) { return rng() < p; }

    var customers = [
      { name: "Sok Dara", phone: "012 345 678" },
      { name: "Chan Sreymom", phone: "096 555 1122" },
      { name: "Heng Vibol", phone: "070 222 918" },
      { name: "Kim Sophal", phone: "089 112 334" },
      { name: "Ly Chenda", phone: "015 887 210" },
      { name: "Meas Pisey", phone: "093 445 667" },
      { name: "Nov Sokha", phone: "077 903 214" },
      { name: "Or Lina", phone: "081 556 902" },
      { name: "Prum Vanna", phone: "092 337 811" },
      { name: "Ros Dalin", phone: "086 220 145" },
      { name: "Sam Ath", phone: "098 774 320" },
      { name: "Sim Bopha", phone: "016 654 981" },
      { name: "Sun Makara", phone: "011 209 763" },
      { name: "Tep Sina", phone: "095 481 207" },
      { name: "Vong Panha", phone: "085 662 190" },
      { name: "Yim Chantha", phone: "017 335 608" },
      { name: "Chea Sopheak", phone: "069 812 447" },
      { name: "Deth Reaksmey", phone: "078 903 561" },
      { name: "Eng Kanha", phone: "090 224 118" },
      { name: "Hor Sophea", phone: "097 663 809" },
      { name: "Im Sreyneang", phone: "099 445 217" },
      { name: "Keo Vuthy", phone: "088 331 776" },
      { name: "Lay Chanthou", phone: "071 552 984" },
      { name: "Meng Kosal", phone: "079 661 230" },
      { name: "Nhem Sreypov", phone: "091 447 663" }
    ];

    var services = [
      "Hearing Consultation",
      "Audiogram Hearing Test",
      "Otoacoustic Emissions Test",
      "Hearing Aid Consultation",
      "Hearing Device Support",
      "Speech and Language Support",
      "Special Education",
      "Academic Assessment"
    ];

    var specialists = ["komanya", "khunnary", "waterworth", "bibek"];
    var times = ["08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
    var messages = ["", "", "", "Follow-up on previous visit.", "Interested in rechargeable models.", "Concern about background noise.", "Referred by a partner clinic.", ""];

    var now = new Date();
    var records = [];
    var recordCount = 78; // within the requested 60-100 range

    // Give ~9 customers a second or third visit so "repeat customers" and
    // returning-patient reporting has real signal.
    var repeatPool = customers.slice(0, 9);

    for (var i = 0; i < recordCount; i++) {
      // Spread across the last ~5.5 months, weighted slightly toward more
      // recent weeks (a realistic growth curve), plus a few days ahead.
      var daysBack = Math.floor(rng() * rng() * 210) - 4; // -4 (future) .. ~206 days back (~7 months, so some first visits predate the 6-month report window)
      var apptDate = new Date(now);
      apptDate.setDate(apptDate.getDate() - daysBack);
      // Skip Sundays (clinic closed) by nudging to Saturday.
      if (apptDate.getDay() === 0) apptDate.setDate(apptDate.getDate() - 1);

      var isRepeatVisit = i > 20 && chance(0.28);
      var customer = isRepeatVisit ? pick(repeatPool) : pick(customers);

      var isFuture = daysBack < 0;
      var status;
      if (isFuture) {
        status = chance(0.6) ? "Confirmed" : (chance(0.5) ? "Pending" : "Contacted");
      } else if (daysBack < 3) {
        status = pick(["Pending", "Contacted", "Confirmed"]);
      } else {
        // Older visits have settled into a final state.
        var roll = rng();
        if (roll < 0.72) status = "Completed";
        else if (roll < 0.85) status = "Cancelled";
        else if (roll < 0.94) status = "No-show";
        else status = "Confirmed";
      }

      var specialist = null;
      if (status === "Completed" || status === "Confirmed" || (status === "Contacted" && chance(0.5))) {
        if (chance(0.82)) specialist = pick(specialists);
      }
      // Keep a realistic slice of brand-new pending requests unassigned.
      if (status === "Pending" && chance(0.75)) specialist = null;

      var createdAt = new Date(apptDate);
      createdAt.setDate(createdAt.getDate() - (1 + Math.floor(rng() * 5)));
      if (createdAt > now) createdAt = new Date(now.getTime() - Math.floor(rng() * 86400000));

      records.push({
        customerName: customer.name,
        phone: customer.phone,
        service: pick(services),
        specialist: specialist,
        date: fmtDate(apptDate),
        time: pick(times),
        message: pick(messages),
        source: "Website",
        status: status,
        createdAt: createdAt.toISOString(),
        history: [{ status: status, at: createdAt.toISOString() }]
      });
    }

    records.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    return records;
  }

  global.C022Demo = {
    LANG_KEY: LANG_KEY,
    BOOKINGS_KEY: BOOKINGS_KEY,
    getLang: getLang,
    setLang: setLang,
    getBookings: readBookings,
    saveBookings: writeBookings,
    addBooking: addBooking,
    updateBooking: updateBooking,
    isDuplicate: isDuplicate,
    seedIfNeeded: seedIfNeeded,
    getCustomers: getCustomers,
    getReportData: getReportData,
    periodRange: periodRange,
    fmtDate: fmtDate
  };
})(window);
