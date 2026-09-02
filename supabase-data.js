/* C022 Hearing Solution Cambodia — Admin dashboard data layer, backed by
   Supabase (public.bookings) instead of the old localStorage demo data.

   This exposes the SAME window.C022Demo API surface the dashboard's
   app.js already uses (getBookings, updateBooking, getCustomers,
   getReportData, periodRange, fmtDate, getLang, setLang, LANG_KEY),
   so app.js's rendering logic (Dashboard, Calendar, Bookings,
   Customers, Reports) keeps working unmodified — only the data source
   underneath changes from localStorage to a real Supabase table.

   It also exposes window.C022Auth for the login screen (sign in/out,
   session check) using supabase-js loaded from CDN + js/supabase-config.js
   (public/publishable key only — never the service_role key). */
(function (global) {
  "use strict";

  var LANG_KEY = "c022Language";

  var sb = global.supabase.createClient(
    global.C022_SUPABASE_URL,
    global.C022_SUPABASE_ANON_KEY
  );

  // Title-Case status (used throughout the existing dashboard UI/i18n/CSS
  // classes) <-> lowercase/snake_case status stored in the database.
  var DB_TO_UI_STATUS = {
    pending: "Pending",
    contacted: "Contacted",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No-show"
  };
  var UI_TO_DB_STATUS = {};
  Object.keys(DB_TO_UI_STATUS).forEach(function (k) {
    UI_TO_DB_STATUS[DB_TO_UI_STATUS[k]] = k;
  });

  function toUiStatus(dbStatus) {
    return DB_TO_UI_STATUS[dbStatus] || dbStatus;
  }
  function toDbStatus(uiStatus) {
    return UI_TO_DB_STATUS[uiStatus] || uiStatus.toLowerCase().replace(/\s+/g, "_");
  }

  function pad(n, len) {
    n = String(n);
    while (n.length < len) n = "0" + n;
    return n;
  }
  function fmtDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }

  function reference(id) {
    return "HS-" + String(id).replace(/-/g, "").slice(0, 8).toUpperCase();
  }

  function toRecord(row) {
    var parsed = global.C022Notes.decode(row.note);
    var uiStatus = toUiStatus(row.status);
    var history = [{ status: "Pending", at: row.created_at }];
    if (row.status !== "pending" && row.updated_at && row.updated_at !== row.created_at) {
      history.push({ status: uiStatus, at: row.updated_at });
    }
    return {
      id: row.id,
      reference: reference(row.id),
      customerName: row.customer_name || "",
      phone: row.phone || "",
      service: parsed.service || "—",
      specialist: null,
      date: row.booking_date || "",
      time: row.booking_time || "",
      message: parsed.message || "",
      source: "Website",
      status: uiStatus,
      adminNote: parsed.adminNote || "",
      history: history,
      createdAt: row.created_at
    };
  }

  /* In-memory cache of the last successful fetch — getBookings() etc. in
     app.js are called synchronously in many places, so we load once
     (after login) and keep this in sync on every write. */
  var cache = [];

  async function fetchBookings() {
    var res = await sb
      .from("bookings")
      .select("id, customer_name, phone, email, booking_date, booking_time, note, status, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (res.error) throw res.error;
    cache = (res.data || []).map(toRecord);
    return cache;
  }

  function getBookings() {
    return cache;
  }

  async function updateBooking(id, patch) {
    var existing = cache.filter(function (b) { return b.id === id; })[0];
    var service = existing ? existing.service : "";
    var message = existing ? existing.message : "";
    var nextAdminNote = patch.adminNote !== undefined ? patch.adminNote : (existing ? existing.adminNote : "");
    var nextStatus = patch.status !== undefined ? patch.status : (existing ? existing.status : "Pending");

    var update = {
      note: global.C022Notes.encode(service === "—" ? "" : service, message, nextAdminNote),
      status: toDbStatus(nextStatus)
    };

    var res = await sb.from("bookings").update(update).eq("id", id);
    if (res.error) throw res.error;

    // Re-fetch so createdAt/updatedAt-derived history stays accurate.
    await fetchBookings();
    return cache.filter(function (b) { return b.id === id; })[0] || null;
  }

  /* ---- Customers / Reports — pure derivations over the cached array,
     unchanged in spirit from the original demo-data.js implementation. ---- */
  function getCustomers() {
    var list = getBookings();
    var byPhone = {};
    var order = [];
    list.forEach(function (b) {
      var key = b.phone || b.customerName;
      if (!byPhone[key]) {
        byPhone[key] = { name: b.customerName, phone: b.phone, bookings: [] };
        order.push(key);
      }
      byPhone[key].bookings.push(b);
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

  function getReportData(start, end) {
    var list = getBookings();
    var startD = new Date(start + "T00:00:00");
    var endD = new Date(end + "T23:59:59");

    function inRange(b) {
      var d = new Date(b.date + "T12:00:00");
      return d >= startD && d <= endD;
    }
    var inPeriod = list.filter(inRange);

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

  function getLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      return v === "kh" ? "kh" : "en";
    } catch (e) {
      return "en";
    }
  }
  function setLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang === "kh" ? "kh" : "en"); } catch (e) {}
  }

  global.C022Demo = {
    LANG_KEY: LANG_KEY,
    BOOKINGS_KEY: null, // no longer applicable (real DB, not localStorage)
    getLang: getLang,
    setLang: setLang,
    getBookings: getBookings,
    fetchBookings: fetchBookings,
    updateBooking: updateBooking,
    seedIfNeeded: function () {}, // no-op: real data comes from Supabase, never seeded
    getCustomers: getCustomers,
    getReportData: getReportData,
    periodRange: periodRange,
    fmtDate: fmtDate
  };

  /* ---- Auth ---- */
  global.C022Auth = {
    signIn: function (email, password) {
      return sb.auth.signInWithPassword({ email: email, password: password });
    },
    signOut: function () {
      return sb.auth.signOut();
    },
    getSession: async function () {
      var res = await sb.auth.getSession();
      return res.data ? res.data.session : null;
    },
    onAuthStateChange: function (cb) {
      return sb.auth.onAuthStateChange(cb);
    },
    /* ---- Forgot / reset password (Supabase Auth built-in recovery flow) ----
       No custom token handling, nothing stored in localStorage — Supabase's
       client library manages the recovery session internally. */
    resetPasswordForEmail: function (email) {
      return sb.auth.resetPasswordForEmail(email, {
        redirectTo: "https://hearingsolutioncambodia.com/admin/"
      });
    },
    updateUserPassword: function (newPassword) {
      return sb.auth.updateUser({ password: newPassword });
    }
  };
})(window);
