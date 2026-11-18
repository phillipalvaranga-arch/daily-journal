/* My Daily Journal — reminder helpers (Central Time math, calendar files, chime).
   Nothing here collects or sends personal data. */
(function (root) {
  "use strict";

  var TZ = "America/Chicago";
  var DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  function pad(n) { return String(n).padStart(2, "0"); }

  var partsFmt = null;
  function zoneParts(epoch) {
    if (!partsFmt) {
      partsFmt = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    }
    var out = {};
    partsFmt.formatToParts(new Date(epoch)).forEach(function (p) { out[p.type] = p.value; });
    var h = Number(out.hour) % 24;
    return {
      y: Number(out.year), m: Number(out.month), d: Number(out.day),
      h: h, min: Number(out.minute), s: Number(out.second)
    };
  }

  /* Central Time "wall clock" for an instant: { date: "YYYY-MM-DD", hhmm: "HH:MM", wall: "YYYY-MM-DDTHH:MM" } */
  function centralNow(epoch) {
    var p = zoneParts(epoch == null ? Date.now() : epoch);
    var date = p.y + "-" + pad(p.m) + "-" + pad(p.d);
    var hhmm = pad(p.h) + ":" + pad(p.min);
    return { date: date, hhmm: hhmm, wall: date + "T" + hhmm };
  }

  function wallOfStamp(iso) {
    if (!iso) return "";
    var t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    return centralNow(t).wall;
  }

  function offsetMinutes(epoch) {
    var p = zoneParts(epoch);
    var asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    return Math.round((asUtc - Math.floor(epoch / 1000) * 1000) / 60000);
  }

  /* Instant (ms) for a Central Time date + "HH:MM". */
  function centralToEpoch(date, hhmm) {
    var dp = String(date).split("-").map(Number);
    var tp = String(hhmm || "00:00").split(":").map(Number);
    var guess = Date.UTC(dp[0], dp[1] - 1, dp[2], tp[0] || 0, tp[1] || 0);
    var off = offsetMinutes(guess);
    var e = guess - off * 60000;
    var off2 = offsetMinutes(e);
    if (off2 !== off) e = guess - off2 * 60000;
    return e;
  }

  function addDays(iso, n) {
    var p = iso.split("-").map(Number);
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }
  function weekday(iso) {
    var p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  }
  function addMinutesWall(date, hhmm, mins) {
    var e = centralToEpoch(date, hhmm) + mins * 60000;
    return centralNow(e);
  }

  function runsOn(rem, iso) {
    var days = Array.isArray(rem.days) ? rem.days : [];
    if (!days.length) return true;
    return days.indexOf(weekday(iso)) !== -1;
  }

  /* First date on/after `fromIso` whose time has not passed (Central). */
  function nextDate(rem, fromIso, nowWall) {
    for (var i = 0; i < 8; i++) {
      var d = addDays(fromIso, i);
      if (!runsOn(rem, d)) continue;
      if (nowWall && (d + "T" + rem.time) < nowWall) continue;
      return d;
    }
    return fromIso;
  }

  function daysLabel(days) {
    var names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var d = Array.isArray(days) ? days.slice().sort() : [];
    if (!d.length || d.length === 7) return "Every day";
    if (d.join(",") === "1,2,3,4,5") return "Weekdays";
    if (d.join(",") === "0,6") return "Weekends";
    return d.map(function (i) { return names[i]; }).join(", ");
  }

  /* ---------- Calendar (.ics) ---------- */
  function icsEscape(s) {
    return String(s == null ? "" : s)
      .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }
  function fold(line) {
    // Fold at 75 octets (UTF-8 safe by characters).
    var out = [];
    var cur = "";
    var bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      var b = new TextEncoder().encode(ch).length;
      if (bytes + b > (out.length ? 74 : 75)) {
        out.push(cur);
        cur = "";
        bytes = 0;
      }
      cur += ch;
      bytes += b;
    }
    out.push(cur);
    return out.join("\r\n ");
  }
  function utcStamp(epoch) {
    var d = new Date(epoch);
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
  }
  function localStamp(date, hhmm) {
    return date.replace(/-/g, "") + "T" + hhmm.replace(":", "") + "00";
  }

  var VTIMEZONE = [
    "BEGIN:VTIMEZONE",
    "TZID:America/Chicago",
    "X-LIC-LOCATION:America/Chicago",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0600",
    "TZOFFSETTO:-0500",
    "TZNAME:CDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0600",
    "TZNAME:CST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE"
  ];

  /* events: [{ uid, title, description, date, time, days (array|null), repeat (bool), minutes }] */
  function buildICS(events, nowEpoch) {
    var stamp = utcStamp(nowEpoch == null ? Date.now() : nowEpoch);
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//My Daily Journal//Reminders//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-TIMEZONE:America/Chicago"
    ].concat(VTIMEZONE);
    events.forEach(function (ev) {
      var mins = ev.minutes || 10;
      var end = addMinutesWall(ev.date, ev.time, mins);
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + ev.uid + "@daily-journal.phillipalvaranga-arch.github.io");
      lines.push("DTSTAMP:" + stamp);
      lines.push("DTSTART;TZID=America/Chicago:" + localStamp(ev.date, ev.time));
      lines.push("DTEND;TZID=America/Chicago:" + localStamp(end.date, end.hhmm));
      lines.push("SUMMARY:" + icsEscape(ev.title));
      if (ev.description) lines.push("DESCRIPTION:" + icsEscape(ev.description));
      if (ev.url) lines.push("URL:" + ev.url);
      if (ev.repeat) {
        var days = Array.isArray(ev.days) ? ev.days.slice().sort() : [];
        if (!days.length || days.length === 7) lines.push("RRULE:FREQ=DAILY");
        else lines.push("RRULE:FREQ=WEEKLY;BYDAY=" + days.map(function (d) { return DAY_CODES[d]; }).join(","));
      }
      lines.push("TRANSP:TRANSPARENT");
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push("DESCRIPTION:" + icsEscape(ev.title));
      lines.push("TRIGGER:-PT0M");
      lines.push("END:VALARM");
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  function googleCalendarUrl(ev) {
    var end = addMinutesWall(ev.date, ev.time, ev.minutes || 10);
    var params = [
      "action=TEMPLATE",
      "text=" + encodeURIComponent(ev.title),
      "dates=" + localStamp(ev.date, ev.time) + "/" + localStamp(end.date, end.hhmm),
      "ctz=" + encodeURIComponent(TZ),
      "details=" + encodeURIComponent(ev.description || "")
    ];
    if (ev.repeat) {
      var days = Array.isArray(ev.days) ? ev.days.slice().sort() : [];
      var rule = (!days.length || days.length === 7) ? "RRULE:FREQ=DAILY"
        : "RRULE:FREQ=WEEKLY;BYDAY=" + days.map(function (d) { return DAY_CODES[d]; }).join(",");
      params.push("recur=" + encodeURIComponent(rule));
    }
    return "https://calendar.google.com/calendar/render?" + params.join("&");
  }

  /* ---------- Soft chime (Web Audio, no files) ---------- */
  var ctx = null;
  function audio() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { ctx = null; }
    }
    return ctx;
  }
  function unlockAudio() {
    var c = audio();
    if (c && c.state === "suspended") { try { c.resume(); } catch (e) {} }
  }
  function chime() {
    var c = audio();
    if (!c) return false;
    try {
      if (c.state === "suspended") c.resume();
      var t0 = c.currentTime + 0.02;
      [[880, 0], [1174.66, 0.22], [1318.5, 0.44]].forEach(function (n) {
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = "sine";
        o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + n[1] + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + 0.9);
        o.connect(g);
        g.connect(c.destination);
        o.start(t0 + n[1]);
        o.stop(t0 + n[1] + 1);
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  var DJReminders = {
    TZ: TZ,
    centralNow: centralNow,
    centralToEpoch: centralToEpoch,
    wallOfStamp: wallOfStamp,
    addDays: addDays,
    weekday: weekday,
    addMinutesWall: addMinutesWall,
    runsOn: runsOn,
    nextDate: nextDate,
    daysLabel: daysLabel,
    buildICS: buildICS,
    googleCalendarUrl: googleCalendarUrl,
    chime: chime,
    unlockAudio: unlockAudio
  };
  if (typeof module !== "undefined" && module.exports) module.exports = DJReminders;
  root.DJReminders = DJReminders;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
