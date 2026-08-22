/* C022 Hearing Solution Cambodia — note field encode/decode helpers.
   The public.bookings table has a single free-text "note" column (by
   design — no extra columns/tables were added). The booking page and
   admin dashboard both need to carry a "service" value and, separately,
   an internal admin note, so this small shared helper packs/unpacks
   those into that one column using a plain, human-readable format:

     Service: <service>
     ---
     <customer message, may be empty>
     ---
     Admin note: <admin note, only present if non-empty>

   Decoding is tolerant of notes that don't follow this format (older
   or hand-edited rows) — anything unrecognized is treated as the
   customer message. */
(function (global) {
  "use strict";

  var DELIM = "\n---\n";
  var SERVICE_PREFIX = "Service: ";
  var ADMIN_PREFIX = "Admin note: ";

  function encode(service, message, adminNote) {
    var parts = [SERVICE_PREFIX + (service || "").trim()];
    parts.push((message || "").trim());
    if (adminNote && adminNote.trim()) {
      parts.push(ADMIN_PREFIX + adminNote.trim());
    }
    return parts.join(DELIM);
  }

  function decode(note) {
    var result = { service: "", message: "", adminNote: "" };
    if (!note) return result;
    var parts = String(note).split(DELIM);
    if (parts[0] && parts[0].indexOf(SERVICE_PREFIX) === 0) {
      result.service = parts[0].slice(SERVICE_PREFIX.length).trim();
      parts = parts.slice(1);
    }
    parts.forEach(function (p) {
      if (p.indexOf(ADMIN_PREFIX) === 0) {
        result.adminNote = p.slice(ADMIN_PREFIX.length).trim();
      } else if (p.trim()) {
        result.message = (result.message ? result.message + "\n" : "") + p.trim();
      }
    });
    return result;
  }

  global.C022Notes = { encode: encode, decode: decode };
})(window);
