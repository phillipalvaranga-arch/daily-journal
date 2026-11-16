/* My Daily Journal — all data stays on this device. Dates use Central Time. */
(function () {
  "use strict";

  const TZ = "America/Chicago";
  const STORE = "daily-journal-v1";
  const THEME_KEY = "dj-theme";
  const VIEWS = ["today", "journal", "progress", "more", "sync"];

  const DEFAULT_CATEGORIES = [
    { id: "work", name: "Work / Trading", color: "#2f5d93" },
    { id: "delivery", name: "Delivery", color: "#c2410c" },
    { id: "health", name: "Health", color: "#1f8a54" },
    { id: "faith", name: "Faith", color: "#7c3aed" },
    { id: "family", name: "Family", color: "#be185d" },
    { id: "home", name: "Home", color: "#0f766e" },
    { id: "money", name: "Money", color: "#a16207" },
    { id: "personal", name: "Personal", color: "#3f6212" }
  ];

  const SUGGESTIONS = [
    { title: "Check blood pressure", categoryId: "health", type: "daily", time: "", blurb: "Every day" },
    { title: "Sabbath School lesson", categoryId: "faith", type: "weekly", weekdays: [6], time: "", blurb: "Every Saturday" },
    { title: "Trading session 8:30 AM", categoryId: "work", type: "weekdays", time: "08:30", blurb: "Weekdays at 8:30 AM" }
  ];

  const MOODS = [
    { id: "down", label: "Down" },
    { id: "off", label: "Off" },
    { id: "okay", label: "Okay" },
    { id: "good", label: "Good" },
    { id: "great", label: "Great" }
  ];
  const ENERGIES = [
    { id: "low", label: "Low" },
    { id: "fair", label: "Fair" },
    { id: "okay", label: "Okay" },
    { id: "strong", label: "Strong" },
    { id: "high", label: "High" }
  ];

  const BADGES = [
    { id: "first-10", name: "First 10", desc: "Completed 10 tasks", glyph: "10" },
    { id: "streak-7", name: "7-day streak", desc: "A perfect week of days in a row", glyph: "7" },
    { id: "streak-30", name: "30-day streak", desc: "30 perfect days in a row", glyph: "30" },
    { id: "century", name: "100 tasks", desc: "Completed 100 tasks", glyph: "100" },
    { id: "perfect-week", name: "Perfect week", desc: "Finished every task every day for a full week", glyph: "*" }
  ];

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
  }
  function addDays(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }
  function weekday(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }
  function weekStart(iso) { return addDays(iso, -weekday(iso)); }
  function weekDays(iso) {
    const start = weekStart(iso);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  function monthStart(iso) { return iso.slice(0, 8) + "01"; }
  function monthEnd(iso) {
    const [y, m] = iso.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return y + "-" + String(m).padStart(2, "0") + "-" + String(last).padStart(2, "0");
  }
  function addMonths(iso, n) {
    const [y, m] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + n, 1));
    const y2 = dt.getUTCFullYear();
    const m2 = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const last = new Date(Date.UTC(y2, dt.getUTCMonth() + 1, 0)).getUTCDate();
    const day = Math.min(Number(iso.slice(8, 10)), last);
    return y2 + "-" + m2 + "-" + String(day).padStart(2, "0");
  }
  function formatLong(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
    });
  }
  function formatMedium(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", timeZone: "UTC"
    });
  }
  function formatMonthYear(iso) {
    const [y, m] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
      month: "long", year: "numeric", timeZone: "UTC"
    });
  }
  function formatTime(hhmm) {
    if (!hhmm) return "";
    const [h, min] = hhmm.split(":").map(Number);
    const am = h < 12;
    const hr = h % 12 || 12;
    return hr + ":" + String(min).padStart(2, "0") + " " + (am ? "AM" : "PM");
  }
  function dateLabel(iso) {
    const t = todayISO();
    if (iso === t) return "Today";
    if (iso === addDays(t, -1)) return "Yesterday";
    if (iso === addDays(t, 1)) return "Tomorrow";
    return formatMedium(iso);
  }
  function nowStamp() { return new Date().toISOString(); }
  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function defaultState() {
    return {
      version: 1,
      categories: DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); }),
      tasks: [],
      recurring: [],
      journal: {},
      skipped: {},
      badgesEarned: {},
      settings: { suggestionsDismissed: false },
      settingsTimes: {},
      tombstones: { tasks: {}, recurring: {}, categories: {}, journal: {}, skipped: {} },
      demo: false
    };
  }

  let state = defaultState();
  let viewDate = todayISO();
  let currentView = "today";
  let progressTab = "daily";
  let progressCursor = todayISO();
  let undo = null;
  let toastTimer = 0;
  let journalSaveTimer = 0;
  let dragId = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) { state = defaultState(); return; }
      const parsed = JSON.parse(raw);
      state = Object.assign(defaultState(), parsed);
      if (!Array.isArray(state.categories) || !state.categories.length) {
        state.categories = DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); });
      }
      if (!Array.isArray(state.tasks)) state.tasks = [];
      if (!Array.isArray(state.recurring)) state.recurring = [];
      if (!state.journal || typeof state.journal !== "object") state.journal = {};
      if (!state.skipped || typeof state.skipped !== "object") state.skipped = {};
      if (!state.badgesEarned || typeof state.badgesEarned !== "object") state.badgesEarned = {};
      if (!state.settings) state.settings = { suggestionsDismissed: false };
      migrateState();
    } catch (err) {
      state = defaultState();
      migrateState();
    }
  }

  function migrateState() {
    if (!state.tombstones) state.tombstones = JournalSync.emptyTombs();
    ["tasks", "recurring", "categories", "journal", "skipped"].forEach(function (k) {
      if (!state.tombstones[k]) state.tombstones[k] = {};
    });
    if (!state.settingsTimes) state.settingsTimes = {};
    if (!state.settings) state.settings = { suggestionsDismissed: false };
    (state.tasks || []).forEach(function (item) {
      if (item && !item.updatedAt) item.updatedAt = item.createdAt || item.doneAt || "";
    });
    (state.recurring || []).forEach(function (item) {
      if (item && !item.updatedAt) item.updatedAt = item.createdAt || "";
    });
    (state.categories || []).forEach(function (item) {
      if (item && !item.updatedAt) item.updatedAt = "";
    });
    Object.keys(state.journal || {}).forEach(function (d) {
      var e = state.journal[d];
      if (e && !e.updatedAt) e.updatedAt = "";
      if (e && !e.fieldTimes) e.fieldTimes = {};
    });
    Object.keys(state.skipped || {}).forEach(function (rid) {
      Object.keys(state.skipped[rid] || {}).forEach(function (day) {
        var e = state.skipped[rid][day];
        if (e === true) state.skipped[rid][day] = { value: true, updatedAt: "" };
      });
    });
    state.version = 2;
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (err) {
      toast("The journal could not be saved. Storage on this device may be full.");
    }
  }

  function persist(opts) {
    opts = opts || {};
    updateBadges();
    save();
    if (!opts.skipPush) schedulePush();
  }

  function touch(obj) {
    if (obj && typeof obj === "object") obj.updatedAt = nowStamp();
    return obj;
  }

  function addTomb(kind, id) {
    if (!state.tombstones) state.tombstones = JournalSync.emptyTombs();
    if (!state.tombstones[kind]) state.tombstones[kind] = {};
    state.tombstones[kind][id] = nowStamp();
  }

  function clearTomb(kind, id) {
    if (state.tombstones && state.tombstones[kind]) delete state.tombstones[kind][id];
  }

  function categoryById(id) {
    return state.categories.find(function (c) { return c.id === id; }) || null;
  }

  function matchesRecurring(rule, iso) {
    if (!rule || rule.enabled === false) return false;
    const start = rule.startDate || (rule.createdAt || "").slice(0, 10);
    if (start && iso < start) return false;
    const dow = weekday(iso);
    if (rule.type === "daily") return true;
    if (rule.type === "weekdays") return dow >= 1 && dow <= 5;
    if (rule.type === "weekly") {
      const days = Array.isArray(rule.weekdays) && rule.weekdays.length ? rule.weekdays : [];
      return days.indexOf(dow) !== -1;
    }
    if (rule.type === "monthly") {
      const day = Number(rule.monthDay || (rule.startDate || iso).slice(8, 10));
      const thisDay = Number(iso.slice(8, 10));
      const last = Number(monthEnd(iso).slice(8, 10));
      return thisDay === (day > last ? last : day);
    }
    return false;
  }

  function isSkipped(rid, iso) {
    var e = state.skipped[rid] && state.skipped[rid][iso];
    if (!e) return false;
    if (e === true) return true;
    return !!e.value;
  }

  function ensureInstancesForDate(iso) {
    let added = false;
    state.recurring.forEach(function (rule) {
      if (!matchesRecurring(rule, iso)) return;
      if (isSkipped(rule.id, iso)) return;
      const exists = state.tasks.some(function (t) {
        return t.recurringId === rule.id && t.date === iso;
      });
      if (exists) return;
      state.tasks.push({
        id: uid(),
        title: rule.title,
        categoryId: rule.categoryId || "",
        priority: rule.priority || "",
        time: rule.time || "",
        date: iso,
        done: false,
        doneAt: null,
        order: nextOrder(iso),
        recurringId: rule.id,
        createdAt: nowStamp(),
        updatedAt: nowStamp()
      });
      added = true;
    });
    if (added) persist();
  }

  function nextOrder(iso) {
    let max = 0;
    state.tasks.forEach(function (t) {
      if (t.date === iso && typeof t.order === "number" && t.order > max) max = t.order;
    });
    return max + 1;
  }

  function tasksForDate(iso) {
    return state.tasks.filter(function (t) { return t.date === iso; });
  }

  function sortTasks(list) {
    return list.slice().sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      if (a.done && b.done) return (b.doneAt || "").localeCompare(a.doneAt || "");
      const at = a.time || "99:99";
      const bt = b.time || "99:99";
      if (at !== bt) return at < bt ? -1 : 1;
      return (a.order || 0) - (b.order || 0);
    });
  }

  function dayStats(iso) {
    const list = tasksForDate(iso);
    const total = list.length;
    const done = list.filter(function (t) { return t.done; }).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const perfect = total > 0 && done === total;
    return { total: total, done: done, pct: pct, perfect: perfect, hasTasks: total > 0 };
  }

  function isPerfectDay(iso) { return dayStats(iso).perfect; }

  function streakEndingOn(iso) {
    let end = iso;
    const t = todayISO();
    if (iso === t && !isPerfectDay(iso)) end = addDays(iso, -1);
    let n = 0;
    let d = end;
    for (let i = 0; i < 4000; i++) {
      if (!isPerfectDay(d)) break;
      n += 1;
      d = addDays(d, -1);
    }
    return n;
  }

  function longestStreak() {
    const dates = {};
    state.tasks.forEach(function (t) { dates[t.date] = true; });
    const keys = Object.keys(dates).sort();
    if (!keys.length) return 0;
    const min = keys[0];
    const max = todayISO() > keys[keys.length - 1] ? todayISO() : keys[keys.length - 1];
    let best = 0, run = 0;
    let d = min;
    while (d <= max) {
      if (isPerfectDay(d)) {
        run += 1;
        if (run > best) best = run;
      } else run = 0;
      d = addDays(d, 1);
    }
    return best;
  }

  function totalCompleted() {
    return state.tasks.filter(function (t) { return t.done; }).length;
  }

  function weekStats(iso) {
    const days = weekDays(iso);
    const perDay = days.map(function (d) { return Object.assign({ date: d }, dayStats(d)); });
    let total = 0, done = 0, best = null;
    perDay.forEach(function (s) {
      total += s.total;
      done += s.done;
      if (s.hasTasks && (!best || s.pct > best.pct || (s.pct === best.pct && s.done > best.done))) best = s;
    });
    const pct = total ? Math.round((done / total) * 100) : 0;
    const perfectDays = perDay.filter(function (s) { return s.perfect; }).length;
    const allSeven = perDay.every(function (s) { return s.perfect; });
    return { days: days, perDay: perDay, total: total, done: done, pct: pct, best: best, perfectDays: perfectDays, allSeven: allSeven };
  }

  function monthStats(iso) {
    const start = monthStart(iso);
    const end = monthEnd(iso);
    const days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    const perDay = days.map(function (d) { return Object.assign({ date: d }, dayStats(d)); });
    let total = 0, done = 0;
    perDay.forEach(function (s) { total += s.total; done += s.done; });
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { start: start, end: end, days: days, perDay: perDay, total: total, done: done, pct: pct };
  }

  function categoryTotals(from, to) {
    const map = {};
    state.categories.forEach(function (c) { map[c.id] = { id: c.id, name: c.name, color: c.color, total: 0, done: 0 }; });
    map[""] = { id: "", name: "No category", color: "#6e7f75", total: 0, done: 0 };
    state.tasks.forEach(function (t) {
      if (t.date < from || t.date > to) return;
      const id = categoryById(t.categoryId) ? t.categoryId : "";
      if (!map[id]) map[id] = { id: id, name: "No category", color: "#6e7f75", total: 0, done: 0 };
      map[id].total += 1;
      if (t.done) map[id].done += 1;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (x) { return x.total > 0; })
      .sort(function (a, b) { return b.done - a.done || b.total - a.total; });
  }

  function weekIsInProgress(iso) {
    const t = todayISO();
    const start = weekStart(iso);
    const end = addDays(start, 6);
    return t >= start && t <= end;
  }
  function monthIsInProgress(iso) {
    const t = todayISO();
    return t >= monthStart(iso) && t <= monthEnd(iso);
  }

  function weeklySeries(n) {
    const t = todayISO();
    const startThis = weekStart(t);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const iso = addDays(startThis, -7 * i);
      const s = weekStats(iso);
      out.push({
        start: weekStart(iso),
        end: addDays(weekStart(iso), 6),
        pct: s.pct,
        done: s.done,
        total: s.total
      });
    }
    const first = out.findIndex(function (s) { return s.total > 0; });
    return first <= 0 ? out : out.slice(first);
  }

  function growthSentence(iso) {
    const cur = weekStats(iso);
    const prev = weekStats(addDays(weekStart(iso), -1));
    if (cur.total === 0 && prev.total === 0) {
      return "No tasks this week or last week yet, so there is no growth figure to show.";
    }
    if (prev.done === 0 && cur.done === 0) {
      return "You have not completed any tasks this week or last week.";
    }
    if (prev.done === 0) {
      return "You completed " + cur.done + " " + (cur.done === 1 ? "task" : "tasks") +
        " this week. Last week has no completed tasks to compare.";
    }
    const diff = cur.done - prev.done;
    const pct = Math.round(Math.abs(diff) / prev.done * 100);
    const soFar = weekIsInProgress(iso) ? " so far" : "";
    if (diff === 0) {
      return "You finished the same number of tasks this week" + soFar + " as last week (" + cur.done + ").";
    }
    if (diff > 0) {
      return "You finished " + pct + "% more tasks this week" + soFar + " than last week (" + cur.done + " vs " + prev.done + ").";
    }
    return "You finished " + pct + "% fewer tasks this week" + soFar + " than last week (" + cur.done + " vs " + prev.done + ").";
  }

  function rateSentence(iso) {
    const cur = weekStats(iso);
    const prev = weekStats(addDays(weekStart(iso), -1));
    if (!cur.total && !prev.total) return "";
    if (!prev.total) return cur.total ? ("Your completion rate this week is " + cur.pct + "%.") : "";
    const soFar = weekIsInProgress(iso) ? " so far" : "";
    if (!cur.total) return "No tasks this week yet. Last week's completion rate was " + prev.pct + "%.";
    if (cur.pct === prev.pct) return "Your completion rate" + soFar + " is " + cur.pct + "%, the same as last week.";
    return "Your completion rate went from " + prev.pct + "% last week to " + cur.pct + "%" + soFar + " this week.";
  }

  function hasPerfectWeek() {
    const dates = {};
    state.tasks.forEach(function (t) { dates[t.date] = true; });
    const keys = Object.keys(dates).sort();
    const seen = {};
    for (let i = 0; i < keys.length; i++) {
      const start = weekStart(keys[i]);
      if (seen[start]) continue;
      seen[start] = true;
      if (weekStats(start).allSeven) return true;
    }
    return false;
  }

  function updateBadges() {
    const today = todayISO();
    const checks = {
      "first-10": totalCompleted() >= 10,
      "streak-7": longestStreak() >= 7 || streakEndingOn(today) >= 7,
      "streak-30": longestStreak() >= 30 || streakEndingOn(today) >= 30,
      "century": totalCompleted() >= 100,
      "perfect-week": hasPerfectWeek()
    };
    Object.keys(checks).forEach(function (id) {
      if (checks[id] && !state.badgesEarned[id]) state.badgesEarned[id] = today;
    });
  }


  function addTask(fields) {
    const title = (fields.title || "").trim();
    if (!title) return null;
    const date = fields.date || viewDate;
    const task = {
      id: uid(),
      title: title,
      categoryId: fields.categoryId || "",
      priority: fields.priority || "",
      time: fields.time || "",
      date: date,
      done: false,
      doneAt: null,
      order: nextOrder(date),
      recurringId: fields.recurringId || null,
      createdAt: nowStamp(),
      updatedAt: nowStamp()
    };
    state.tasks.push(task);
    persist();
    return task;
  }

  function getTask(id) {
    return state.tasks.find(function (t) { return t.id === id; }) || null;
  }

  function toggleTask(id) {
    const t = getTask(id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? nowStamp() : null;
    touch(t);
    persist();
  }

  function updateTask(id, patch) {
    const t = getTask(id);
    if (!t) return;
    Object.keys(patch).forEach(function (k) { t[k] = patch[k]; });
    touch(t);
    persist();
  }

  function deleteTask(id, skipRecurring) {
    const idx = state.tasks.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return;
    const t = state.tasks[idx];
    state.tasks.splice(idx, 1);
    addTomb("tasks", t.id);
    if (skipRecurring && t.recurringId) {
      if (!state.skipped[t.recurringId]) state.skipped[t.recurringId] = {};
      state.skipped[t.recurringId][t.date] = { value: true, updatedAt: nowStamp() };
    }
    persist();
    undo = { type: "task", task: t, skipped: skipRecurring };
    toast("Task deleted.", function () {
      clearTomb("tasks", t.id);
      touch(t);
      state.tasks.push(t);
      if (skipRecurring && t.recurringId) {
        if (!state.skipped[t.recurringId]) state.skipped[t.recurringId] = {};
        state.skipped[t.recurringId][t.date] = { value: false, updatedAt: nowStamp() };
      }
      persist();
      undo = null;
      render();
    });
  }

  function moveToTomorrow(id) {
    const t = getTask(id);
    if (!t || t.done) return;
    const next = addDays(t.date, 1);
    t.date = next;
    t.order = nextOrder(next);
    touch(t);
    persist();
    toast("Moved to " + dateLabel(next) + ".");
  }

  function reorderOpen(iso, ids) {
    ids.forEach(function (id, i) {
      const t = getTask(id);
      if (t && t.date === iso && !t.done) {
        t.order = i + 1;
        touch(t);
      }
    });
    persist();
  }

  function addRecurringFromSuggestion(s) {
    const rule = {
      id: uid(),
      title: s.title,
      categoryId: s.categoryId || "",
      priority: "",
      time: s.time || "",
      type: s.type,
      weekdays: s.weekdays ? s.weekdays.slice() : [],
      monthDay: s.monthDay || null,
      enabled: true,
      startDate: todayISO(),
      createdAt: nowStamp(),
      updatedAt: nowStamp()
    };
    state.recurring.push(rule);
    persist();
    ensureInstancesForDate(viewDate);
    const showsToday = matchesRecurring(rule, todayISO());
    toast(showsToday
      ? "Added. It is on today's list."
      : "Added. It will show up on the days you chose.");
  }

  function getJournal(iso) {
    return state.journal[iso] || { notes: "", wins: "", grateful: "", tomorrow: "", mood: "", energy: "" };
  }
  function setJournal(iso, patch) {
    const cur = Object.assign({}, getJournal(iso), patch);
    if (!cur.fieldTimes) cur.fieldTimes = {};
    const now = nowStamp();
    Object.keys(patch).forEach(function (k) { cur.fieldTimes[k] = now; });
    cur.updatedAt = now;
    state.journal[iso] = cur;
    persist();
  }

  const toastEl = document.getElementById("toast");
  function toast(msg, onUndo) {
    clearTimeout(toastTimer);
    toastEl.innerHTML = "";
    const span = document.createElement("span");
    span.textContent = msg;
    toastEl.appendChild(span);
    if (onUndo) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Undo";
      b.addEventListener("click", function () {
        toastEl.classList.remove("show");
        onUndo();
      });
      toastEl.appendChild(b);
    }
    toastEl.classList.add("show");
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); undo = null; }, 5000);
  }

  const modalEl = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalActions = document.getElementById("modalActions");

  function closeModal() {
    modalEl.hidden = true;
    modalBody.innerHTML = "";
    modalActions.innerHTML = "";
  }

  function openModal(title, bodyHTML, actions) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHTML;
    modalActions.innerHTML = "";
    (actions || []).forEach(function (a) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn" + (a.cls ? " " + a.cls : "");
      b.textContent = a.label;
      b.addEventListener("click", a.onClick);
      modalActions.appendChild(b);
    });
    modalEl.hidden = false;
    const first = modalBody.querySelector("input, select, textarea, button");
    if (first) first.focus();
  }

  modalEl.addEventListener("click", function (e) {
    if (e.target === modalEl) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modalEl.hidden) closeModal();
  });

  function categorySelectHTML(selected, includeNone) {
    let html = includeNone ? '<option value="">None</option>' : "";
    state.categories.forEach(function (c) {
      html += '<option value="' + escapeHtml(c.id) + '"' + (c.id === selected ? " selected" : "") + ">" +
        escapeHtml(c.name) + "</option>";
    });
    return html;
  }

  function fillCategorySelect() {
    const sel = document.getElementById("taskCategory");
    sel.innerHTML = categorySelectHTML(sel.value || "", true);
  }

  function renderHeader() {
    const t = todayISO();
    document.getElementById("headerSub").textContent = formatLong(t) + " · Central Time";
    const theme = localStorage.getItem(THEME_KEY) || "system";
    const isDark = document.documentElement.dataset.theme === "dark";
    const btn = document.getElementById("themeBtn");
    btn.textContent = isDark ? "Light mode" : "Dark mode";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-theme-set") === theme);
    });
    document.getElementById("demoBanner").hidden = !state.demo;
  }

  function renderDailyStrip() {
    const s = dayStats(viewDate);
    const streak = streakEndingOn(todayISO());
    const el = document.getElementById("dailyStrip");
    const pctLabel = s.hasTasks ? s.pct + "%" : "—";
    const doneLabel = s.done + " of " + s.total;
    el.innerHTML =
      '<div><span class="num" id="statPct">' + escapeHtml(pctLabel) + '</span><span class="lbl">Completed</span></div>' +
      '<div><span class="num" id="statDone">' + escapeHtml(String(s.done)) + '</span><span class="lbl">' +
        (s.done === 1 ? "Task done" : "Tasks done") + " (" + escapeHtml(doneLabel) + ")</span></div>" +
      '<div><span class="num" id="statStreak">' + streak + '</span><span class="lbl">Day streak</span></div>';
  }

  function renderSuggestions() {
    const box = document.getElementById("suggestions");
    if (state.settings.suggestionsDismissed || currentView !== "today") {
      box.hidden = true;
      return;
    }
    const remaining = SUGGESTIONS.filter(function (s) {
      return !state.recurring.some(function (r) { return r.title === s.title; });
    });
    if (!remaining.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const list = document.getElementById("suggestList");
    list.innerHTML = remaining.map(function (s) {
      return '<button type="button" data-stitle="' + escapeHtml(s.title) + '"><strong>' + escapeHtml(s.title) +
        '</strong><span>' + escapeHtml(s.blurb) + "</span></button>";
    }).join("");
    list.querySelectorAll("[data-stitle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const title = btn.getAttribute("data-stitle");
        const s = remaining.find(function (x) { return x.title === title; });
        if (s) addRecurringFromSuggestion(s);
        render();
      });
    });
  }

  function taskItemHTML(t) {
    const cat = categoryById(t.categoryId);
    let meta = "";
    if (cat) {
      meta += '<span class="badge"><span class="dot" style="background:' + escapeHtml(cat.color) + '"></span>' +
        escapeHtml(cat.name) + "</span>";
    }
    if (t.priority) {
      const label = t.priority === "high" ? "High" : t.priority === "medium" ? "Medium" : "Low";
      meta += '<span class="badge ' + escapeHtml(t.priority) + '">' + label + "</span>";
    }
    if (t.time) meta += '<span class="badge time">' + escapeHtml(formatTime(t.time)) + "</span>";
    return (
      '<li class="task' + (t.done ? " done" : "") + '" data-id="' + escapeHtml(t.id) + '">' +
        '<button type="button" class="drag-handle" aria-label="Reorder ' + escapeHtml(t.title) + '" ' +
          (t.done ? "tabindex='-1'" : "") + ">&#8942;&#8942;</button>" +
        '<button type="button" class="task-check" aria-pressed="' + (t.done ? "true" : "false") + '" aria-label="' +
          (t.done ? "Mark not done: " : "Mark done: ") + escapeHtml(t.title) + '"><span class="box">&#10003;</span></button>' +
        '<button type="button" class="task-body" aria-label="Edit ' + escapeHtml(t.title) + '">' +
          '<span class="task-title">' + escapeHtml(t.title) + "</span>" +
          (meta ? '<div class="task-meta">' + meta + "</div>" : "") +
        "</button>" +
      "</li>"
    );
  }

  function renderTasks() {
    const list = sortTasks(tasksForDate(viewDate));
    const open = list.filter(function (t) { return !t.done; });
    const done = list.filter(function (t) { return t.done; });
    const wrap = document.getElementById("taskLists");
    let html = "";
    html += '<div class="list-h"><h3>To do</h3><span class="count">' + open.length + "</span></div>";
    if (!open.length) {
      html += '<p class="empty" id="emptyOpen">Nothing on your list yet. Add a task above to start the day.</p>';
    } else {
      html += '<ul class="task-list" id="openList">' + open.map(taskItemHTML).join("") + "</ul>";
    }
    html += '<div class="list-h"><h3>Completed</h3><span class="count" id="doneCount">' + done.length + "</span></div>";
    if (!done.length) {
      html += '<p class="empty">Checked-off tasks will stay here so you can see what you finished.</p>';
    } else {
      html += '<ul class="task-list" id="doneList">' + done.map(taskItemHTML).join("") + "</ul>";
    }
    wrap.innerHTML = html;
    bindTaskList(wrap);
  }

  function bindTaskList(root) {
    root.querySelectorAll(".task-check").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const li = btn.closest(".task");
        const id = li.getAttribute("data-id");
        const wasDone = li.classList.contains("done");
        toggleTask(id);
        if (!wasDone) {
          li.classList.add("done");
          btn.setAttribute("aria-pressed", "true");
          setTimeout(function () { renderToday(); }, 420);
        } else {
          renderToday();
        }
      });
    });
    root.querySelectorAll(".task-body").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openEditTask(btn.closest(".task").getAttribute("data-id"));
      });
    });
    bindDrag(root);
  }

  function bindDrag(root) {
    const list = root.querySelector("#openList");
    if (!list) return;
    list.querySelectorAll(".drag-handle").forEach(function (handle) {
      handle.addEventListener("pointerdown", function (e) {
        if (e.button && e.button !== 0) return;
        const li = handle.closest(".task");
        dragId = li.getAttribute("data-id");
        li.classList.add("dragging");
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener("pointermove", function (e) {
        if (!dragId) return;
        const li = list.querySelector('.task[data-id="' + dragId + '"]');
        if (!li) return;
        const items = Array.from(list.querySelectorAll(".task"));
        const y = e.clientY;
        let target = null;
        items.forEach(function (item) {
          if (item === li) return;
          const r = item.getBoundingClientRect();
          if (y > r.top && y < r.bottom) target = item;
        });
        items.forEach(function (item) { item.classList.toggle("drop-target", item === target); });
        if (target) {
          const r = target.getBoundingClientRect();
          if (y < r.top + r.height / 2) list.insertBefore(li, target);
          else list.insertBefore(li, target.nextSibling);
        }
      });
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);
    });
    function endDrag() {
      if (!dragId) return;
      const ids = Array.from(list.querySelectorAll(".task")).map(function (el) { return el.getAttribute("data-id"); });
      list.querySelectorAll(".task").forEach(function (el) { el.classList.remove("dragging", "drop-target"); });
      reorderOpen(viewDate, ids);
      dragId = null;
    }
  }

  function openEditTask(id) {
    const t = getTask(id);
    if (!t) return;
    const moveLabel = t.date === todayISO() ? "Move to tomorrow" : "Move to next day";
    openModal("Edit task",
      '<label><span>Task</span><input id="edTitle" type="text" maxlength="200" value="' + escapeHtml(t.title) + '"></label>' +
      '<label><span>Category</span><select id="edCat">' + categorySelectHTML(t.categoryId || "", true) + "</select></label>" +
      '<label><span>Priority</span><select id="edPri">' +
        '<option value="">None</option>' +
        '<option value="high"' + (t.priority === "high" ? " selected" : "") + ">High</option>" +
        '<option value="medium"' + (t.priority === "medium" ? " selected" : "") + ">Medium</option>" +
        '<option value="low"' + (t.priority === "low" ? " selected" : "") + ">Low</option>" +
      "</select></label>" +
      '<label><span>Time</span><input id="edTime" type="time" value="' + escapeHtml(t.time || "") + '"></label>' +
      '<label><span>Date</span><input id="edDate" type="date" value="' + escapeHtml(t.date) + '"></label>',
      [
        { label: "Save", cls: "primary", onClick: function () {
          const title = document.getElementById("edTitle").value.trim();
          if (!title) { document.getElementById("edTitle").focus(); return; }
          const date = document.getElementById("edDate").value || t.date;
          updateTask(t.id, {
            title: title,
            categoryId: document.getElementById("edCat").value,
            priority: document.getElementById("edPri").value,
            time: document.getElementById("edTime").value,
            date: date
          });
          closeModal();
          render();
        }},
        { label: "Cancel", cls: "ghost", onClick: closeModal },
        !t.done ? { label: moveLabel, onClick: function () { moveToTomorrow(t.id); closeModal(); render(); } } : null,
        { label: "Delete", cls: "danger", onClick: function () { closeModal(); deleteTask(t.id, !!t.recurringId); render(); } }
      ].filter(Boolean)
    );
  }

  function renderToday() {
    const t = todayISO();
    document.getElementById("todayTitle").textContent = dateLabel(viewDate);
    document.getElementById("todayDate").textContent = formatLong(viewDate);
    document.getElementById("jumpTodayBtn").hidden = viewDate === t;
    ensureInstancesForDate(viewDate);
    renderDailyStrip();
    renderSuggestions();
    renderTasks();
  }


  function renderPills(root, items, value, name) {
    root.innerHTML = items.map(function (m) {
      const on = value === m.id;
      return '<button type="button" class="pill" role="radio" aria-checked="' + (on ? "true" : "false") +
        '" data-val="' + escapeHtml(m.id) + '">' + escapeHtml(m.label) + "</button>";
    }).join("");
    root.querySelectorAll(".pill").forEach(function (b) {
      b.addEventListener("click", function () {
        const v = b.getAttribute("data-val");
        const cur = getJournal(viewDate);
        const next = cur[name] === v ? "" : v;
        const patch = {};
        patch[name] = next;
        setJournal(viewDate, patch);
        renderJournal();
      });
    });
  }

  function renderJournal() {
    const t = todayISO();
    document.getElementById("journalTitle").textContent = "Journal · " + dateLabel(viewDate);
    document.getElementById("journalDate").textContent = formatLong(viewDate);
    document.getElementById("jJumpTodayBtn").hidden = viewDate === t;
    const j = getJournal(viewDate);
    document.getElementById("jNotes").value = j.notes || "";
    document.getElementById("jWins").value = j.wins || "";
    document.getElementById("jGrateful").value = j.grateful || "";
    document.getElementById("jTomorrow").value = j.tomorrow || "";
    renderPills(document.getElementById("moodPicker"), MOODS, j.mood || "", "mood");
    renderPills(document.getElementById("energyPicker"), ENERGIES, j.energy || "", "energy");
  }

  function bindJournalFields() {
    const map = { jNotes: "notes", jWins: "wins", jGrateful: "grateful", jTomorrow: "tomorrow" };
    Object.keys(map).forEach(function (id) {
      document.getElementById(id).addEventListener("input", function () {
        const field = map[id];
        const val = document.getElementById(id).value;
        clearTimeout(journalSaveTimer);
        journalSaveTimer = setTimeout(function () {
          const patch = {};
          patch[field] = val;
          setJournal(viewDate, patch);
          const line = document.getElementById("journalSaved");
          line.textContent = "Saved on this device.";
          setTimeout(function () { if (line.textContent === "Saved on this device.") line.textContent = ""; }, 2000);
        }, 300);
      });
    });
  }

  function svgEl(w, h, inner) {
    return '<svg class="chart" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h +
      '" role="img">' + inner + "</svg>";
  }

  function barChart(perDay) {
    const w = 640, h = 240, padL = 36, padR = 12, padT = 18, padB = 36;
    const cw = w - padL - padR, ch = h - padT - padB;
    const n = perDay.length;
    const gap = 10;
    const bw = (cw - gap * (n - 1)) / n;
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let bars = "";
    for (let p = 0; p <= 100; p += 25) {
      const y = padT + ch - (p / 100) * ch;
      bars += '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y +
        '" stroke="currentColor" stroke-opacity="0.15"/>';
      bars += '<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="currentColor" fill-opacity="0.6">' + p + "</text>";
    }
    perDay.forEach(function (s, i) {
      const x = padL + i * (bw + gap);
      const ph = s.hasTasks ? (s.pct / 100) * ch : 0;
      const y = padT + ch - ph;
      const label = dow[weekday(s.date)];
      const color = !s.hasTasks ? "rgba(110,127,117,0.25)" : (s.pct === 100 ? "#1f8a54" : s.pct >= 50 ? "#52b788" : "#d4a017");
      if (!s.hasTasks) {
        bars += '<rect x="' + x + '" y="' + (padT + ch - 6) + '" width="' + bw + '" height="6" rx="3" fill="' + color + '"/>';
      } else {
        bars += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + Math.max(ph, 3) + '" rx="6" fill="' + color + '"/>';
        bars += '<text x="' + (x + bw / 2) + '" y="' + (y - 6) + '" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">' + s.pct + "%</text>";
      }
      bars += '<text x="' + (x + bw / 2) + '" y="' + (h - 14) + '" text-anchor="middle" font-size="12" fill="currentColor">' + label + "</text>";
    });
    return svgEl(w, h, bars);
  }

  function lineChart(series) {
    const w = 640, h = 240, padL = 36, padR = 16, padT = 18, padB = 40;
    const cw = w - padL - padR, ch = h - padT - padB;
    const n = series.length;
    if (!n) return "";
    function xAt(i) { return padL + (n === 1 ? cw / 2 : (i / (n - 1)) * cw); }
    function yAt(pct) { return padT + ch - (pct / 100) * ch; }
    let g = "";
    for (let p = 0; p <= 100; p += 25) {
      g += '<line x1="' + padL + '" y1="' + yAt(p) + '" x2="' + (w - padR) + '" y2="' + yAt(p) +
        '" stroke="currentColor" stroke-opacity="0.15"/>';
      g += '<text x="' + (padL - 6) + '" y="' + (yAt(p) + 4) + '" text-anchor="end" font-size="11" fill="currentColor" fill-opacity="0.6">' + p + "%</text>";
    }
    const pts = series.map(function (s, i) { return xAt(i) + "," + yAt(s.pct); }).join(" ");
    g += '<polyline fill="none" stroke="#1f8a54" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="' + pts + '"/>';
    series.forEach(function (s, i) {
      g += '<circle cx="' + xAt(i) + '" cy="' + yAt(s.pct) + '" r="5" fill="#1f8a54"/>';
      const parts = s.start.split("-");
      const lab = Number(parts[1]) + "/" + Number(parts[2]);
      g += '<text x="' + xAt(i) + '" y="' + (h - 14) + '" text-anchor="middle" font-size="11" fill="currentColor">' + lab + "</text>";
    });
    return svgEl(w, h, g);
  }

  function heatClass(s) {
    if (!s.hasTasks) return "none";
    if (s.pct === 0) return "p0";
    if (s.pct < 50) return "p1";
    if (s.pct < 80) return "p2";
    if (s.pct < 100) return "p3";
    return "p4";
  }

  function renderHeatmap(ms) {
    const startDow = weekday(ms.start);
    const t = todayISO();
    let html = '<div class="heat-grid">';
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (d) {
      html += '<div class="heat-dow">' + d + "</div>";
    });
    for (let i = 0; i < startDow; i++) html += '<div class="heat-cell empty"></div>';
    ms.perDay.forEach(function (s) {
      const dayNum = Number(s.date.slice(8, 10));
      const cls = "heat-cell " + heatClass(s) + (s.date === t ? " today" : "");
      const label = s.hasTasks ? (s.pct + "%") : "—";
      html += '<button type="button" class="' + cls + '" data-jump="' + s.date + '" title="' +
        escapeHtml(formatMedium(s.date) + " · " + (s.hasTasks ? (s.done + " of " + s.total + " done") : "No tasks")) +
        '"><span class="d">' + dayNum + '</span><span class="p">' + label + "</span></button>";
    });
    html += "</div>";
    return html;
  }

  function renderCatBars(from, to) {
    const rows = categoryTotals(from, to);
    if (!rows.length) return "<p class='hint'>No categorized tasks in this period.</p>";
    const max = Math.max.apply(null, rows.map(function (r) { return r.total; })) || 1;
    return '<div class="cat-bars">' + rows.map(function (r) {
      const w = Math.round((r.total / max) * 100);
      return '<div class="cat-row"><span>' + escapeHtml(r.name) + '</span><span>' + r.done + " of " + r.total +
        '</span><div class="bar-track"><div class="bar-fill" style="width:' + w + "%;background:" + escapeHtml(r.color) +
        '"></div></div></div>';
    }).join("") + "</div>";
  }

  function metricHTML(num, lbl) {
    return '<div class="metric"><span class="num">' + escapeHtml(String(num)) + '</span><span class="lbl">' + escapeHtml(lbl) + "</span></div>";
  }

  function renderProgress() {
    const body = document.getElementById("progressBody");
    document.querySelectorAll(".subnav [data-progress]").forEach(function (b) {
      const on = b.getAttribute("data-progress") === progressTab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    if (progressTab === "daily") {
      const s = dayStats(progressCursor);
      const streak = streakEndingOn(todayISO());
      body.innerHTML =
        '<div class="date-nav">' +
          '<button type="button" class="icon-btn" id="pPrev" aria-label="Previous day">&#8249;</button>' +
          '<div class="date-display"><h2>' + escapeHtml(dateLabel(progressCursor)) + "</h2>" +
          '<p class="date-line">' + escapeHtml(formatLong(progressCursor)) + "</p></div>" +
          '<button type="button" class="icon-btn" id="pNext" aria-label="Next day">&#8250;</button></div>' +
        '<div class="metric-grid">' +
          metricHTML(s.hasTasks ? s.pct + "%" : "—", "Completion") +
          metricHTML(s.done, s.done === 1 ? "Task done" : "Tasks done") +
          metricHTML(streak, "Day streak") +
        "</div>" +
        '<p class="hint">A streak counts consecutive days when every task on the list was finished. Today only counts once the day is complete.</p>';
      document.getElementById("pPrev").addEventListener("click", function () { progressCursor = addDays(progressCursor, -1); renderProgress(); });
      document.getElementById("pNext").addEventListener("click", function () { progressCursor = addDays(progressCursor, 1); renderProgress(); });
    } else if (progressTab === "weekly") {
      const ws = weekStats(progressCursor);
      const prev = weekStats(addDays(weekStart(progressCursor), -1));
      const weekLbl = formatMedium(ws.days[0]) + " – " + formatMedium(ws.days[6]);
      let best = "No tasks this week";
      if (ws.best) best = formatMedium(ws.best.date) + " (" + ws.best.pct + "%)";
      let growth = "—";
      if (prev.done === 0 && ws.done === 0) growth = "No comparison yet";
      else if (prev.done === 0) growth = "No last-week figure";
      else {
        const diff = ws.done - prev.done;
        const pct = Math.round(Math.abs(diff) / prev.done * 100);
        growth = (diff >= 0 ? "+" : "−") + pct + "%";
      }
      body.innerHTML =
        '<div class="date-nav">' +
          '<button type="button" class="icon-btn" id="pPrev" aria-label="Previous week">&#8249;</button>' +
          '<div class="date-display"><h2>Week</h2><p class="date-line">' + escapeHtml(weekLbl) + "</p></div>" +
          '<button type="button" class="icon-btn" id="pNext" aria-label="Next week">&#8250;</button></div>' +
        '<div class="metric-grid">' +
          metricHTML(ws.total ? ws.pct + "%" : "—", "Completion") +
          metricHTML(best, "Best day") +
          metricHTML(growth, weekIsInProgress(progressCursor) ? "Vs last week, so far" : "Vs last week") +
        "</div>" +
        '<p class="growth-line" id="weekGrowth">' + escapeHtml(growthSentence(progressCursor)) +
          (rateSentence(progressCursor) ? " " + escapeHtml(rateSentence(progressCursor)) : "") + "</p>" +
        '<div class="card chart-card"><h3>Tasks finished by day</h3>' + barChart(ws.perDay) +
        '<p class="hint">Short gray marks are days with no tasks. Weeks run Sunday through Saturday, Central Time.</p></div>';
      document.getElementById("pPrev").addEventListener("click", function () { progressCursor = addDays(weekStart(progressCursor), -1); renderProgress(); });
      document.getElementById("pNext").addEventListener("click", function () { progressCursor = addDays(weekStart(progressCursor), 7); renderProgress(); });
    } else if (progressTab === "monthly") {
      const ms = monthStats(progressCursor);
      const prevM = monthStats(addMonths(monthStart(progressCursor), -1));
      let growth = "—";
      if (prevM.done === 0 && ms.done === 0) growth = "No comparison yet";
      else if (prevM.done === 0) growth = "No last-month figure";
      else {
        const diff = ms.done - prevM.done;
        const pct = Math.round(Math.abs(diff) / prevM.done * 100);
        growth = (diff >= 0 ? "+" : "−") + pct + "%";
      }
      const long = longestStreak();
      body.innerHTML =
        '<div class="date-nav">' +
          '<button type="button" class="icon-btn" id="pPrev" aria-label="Previous month">&#8249;</button>' +
          '<div class="date-display"><h2>' + escapeHtml(formatMonthYear(progressCursor)) + "</h2>" +
          '<p class="date-line">Central Time</p></div>' +
          '<button type="button" class="icon-btn" id="pNext" aria-label="Next month">&#8250;</button></div>' +
        '<div class="metric-grid">' +
          metricHTML(ms.total ? ms.pct + "%" : "—", "Completion") +
          metricHTML(growth, monthIsInProgress(progressCursor) ? "Vs last month, so far" : "Vs last month") +
          metricHTML(long, "Longest streak") +
        "</div>" +
        '<div class="card chart-card"><h3>Calendar</h3>' + renderHeatmap(ms) +
        '<p class="hint">Color shows how much of that day’s list was finished. Gray means no tasks. Tap a day to open it.</p></div>' +
        '<div class="card"><h3>Totals by category</h3>' + renderCatBars(ms.start, ms.end) + "</div>";
      document.getElementById("pPrev").addEventListener("click", function () {
        progressCursor = addMonths(monthStart(progressCursor), -1);
        renderProgress();
      });
      document.getElementById("pNext").addEventListener("click", function () {
        progressCursor = addMonths(monthStart(progressCursor), 1);
        renderProgress();
      });
      body.querySelectorAll("[data-jump]").forEach(function (b) {
        b.addEventListener("click", function () {
          viewDate = b.getAttribute("data-jump");
          showView("today");
        });
      });
    } else {
      const series = weeklySeries(12);
      body.innerHTML =
        '<p class="growth-line" id="growthSummary">' + escapeHtml(growthSentence(todayISO())) +
          (rateSentence(todayISO()) ? " " + escapeHtml(rateSentence(todayISO())) : "") + "</p>" +
        '<div class="card chart-card"><h3>Weekly completion rate</h3>' + lineChart(series) +
        '<p class="hint">Each point is one week, Sunday through Saturday, showing the share of tasks you finished. Weeks before your first task are left off. The current week is shown as it stands so far.</p></div>' +
        '<div class="card"><h3>This month by category</h3>' +
          renderCatBars(monthStart(todayISO()), monthEnd(todayISO())) + "</div>";
    }

    renderBadges();
  }

  function renderBadges() {
    const el = document.getElementById("badgeBoard");
    el.innerHTML = "<h3>Badges</h3><div class='badge-grid'>" + BADGES.map(function (b) {
      const earned = state.badgesEarned[b.id];
      return '<div class="badge-card' + (earned ? " earned" : " locked") + '">' +
        '<span class="glyph">' + (earned ? "★" : "☆") + "</span>" +
        '<span class="name">' + escapeHtml(b.name) + "</span>" +
        '<span class="desc">' + escapeHtml(b.desc) +
          (earned ? " · Earned " + formatMedium(earned) : " · Not earned yet") +
        "</span></div>";
    }).join("") + "</div>";
  }


  function scheduleLabel(rule) {
    if (rule.type === "daily") return "Every day" + (rule.time ? " at " + formatTime(rule.time) : "");
    if (rule.type === "weekdays") return "Weekdays" + (rule.time ? " at " + formatTime(rule.time) : "");
    if (rule.type === "weekly") {
      const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const days = (rule.weekdays || []).map(function (d) { return names[d]; }).join(", ") || "chosen days";
      return "Weekly on " + days + (rule.time ? " at " + formatTime(rule.time) : "");
    }
    if (rule.type === "monthly") {
      return "Monthly on day " + (rule.monthDay || "—") + (rule.time ? " at " + formatTime(rule.time) : "");
    }
    return "";
  }

  function renderMore() {
    renderSyncSummary();
    const list = document.getElementById("recurringList");
    if (!state.recurring.length) {
      list.innerHTML = "<p class='hint'>You have no repeating tasks yet.</p>";
    } else {
      list.innerHTML = state.recurring.map(function (r) {
        const paused = r.enabled === false;
        return '<div class="rec-item" data-rid="' + escapeHtml(r.id) + '">' +
          '<div class="grow"><strong>' + escapeHtml(r.title) + (paused ? " (paused)" : "") + "</strong>" +
          '<div class="sched">' + escapeHtml(scheduleLabel(r)) + "</div></div>" +
          '<button type="button" class="btn ghost rec-edit">Edit</button>' +
          '<button type="button" class="btn ghost rec-toggle">' + (paused ? "Resume" : "Pause") + "</button>" +
          "</div>";
      }).join("");
      list.querySelectorAll(".rec-edit").forEach(function (b) {
        b.addEventListener("click", function () { openRecurringEditor(b.closest(".rec-item").getAttribute("data-rid")); });
      });
      list.querySelectorAll(".rec-toggle").forEach(function (b) {
        b.addEventListener("click", function () {
          const r = state.recurring.find(function (x) { return x.id === b.closest(".rec-item").getAttribute("data-rid"); });
          if (!r) return;
          r.enabled = r.enabled === false;
          touch(r);
          persist();
          if (r.enabled) ensureInstancesForDate(todayISO());
          renderMore();
        });
      });
    }

    const cats = document.getElementById("categoryList");
    cats.innerHTML = state.categories.map(function (c) {
      return '<div class="cat-item" data-cid="' + escapeHtml(c.id) + '">' +
        '<span class="color-dot" style="background:' + escapeHtml(c.color) + '"></span>' +
        '<input type="text" class="grow cat-name" maxlength="40" value="' + escapeHtml(c.name) + '" aria-label="Category name">' +
        '<button type="button" class="btn ghost cat-del">Remove</button></div>';
    }).join("");
    cats.querySelectorAll(".cat-name").forEach(function (inp) {
      inp.addEventListener("change", function () {
        const c = categoryById(inp.closest(".cat-item").getAttribute("data-cid"));
        const name = inp.value.trim();
        if (!c || !name) { renderMore(); return; }
        c.name = name;
        touch(c);
        persist();
        fillCategorySelect();
      });
    });
    cats.querySelectorAll(".cat-del").forEach(function (b) {
      b.addEventListener("click", function () {
        const id = b.closest(".cat-item").getAttribute("data-cid");
        const used = state.tasks.some(function (t) { return t.categoryId === id; }) ||
          state.recurring.some(function (r) { return r.categoryId === id; });
        if (used && !confirm("This category is used on some tasks. Remove it anyway? Those tasks will show as uncategorized.")) return;
        state.categories = state.categories.filter(function (c) { return c.id !== id; });
        addTomb("categories", id);
        persist();
        fillCategorySelect();
        renderMore();
      });
    });
    renderHeader();
  }

  function weekdayChecks(selected) {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const sel = selected || [];
    return names.map(function (n, i) {
      return '<label style="display:inline-flex;align-items:center;gap:6px;margin:0 8px 8px 0;">' +
        '<input type="checkbox" class="wd" value="' + i + '"' + (sel.indexOf(i) !== -1 ? " checked" : "") + "> " + n + "</label>";
    }).join("");
  }

  function openRecurringEditor(id) {
    const r = id ? state.recurring.find(function (x) { return x.id === id; }) : null;
    const title = r ? "Edit repeating task" : "Add a repeating task";
    openModal(title,
      '<label><span>Task</span><input id="rcTitle" type="text" maxlength="200" value="' + escapeHtml(r ? r.title : "") + '"></label>' +
      '<label><span>Category</span><select id="rcCat">' + categorySelectHTML(r ? r.categoryId : "", true) + "</select></label>" +
      '<label><span>Priority</span><select id="rcPri">' +
        '<option value="">None</option>' +
        '<option value="high"' + (r && r.priority === "high" ? " selected" : "") + ">High</option>" +
        '<option value="medium"' + (r && r.priority === "medium" ? " selected" : "") + ">Medium</option>" +
        '<option value="low"' + (r && r.priority === "low" ? " selected" : "") + ">Low</option></select></label>" +
      '<label><span>Time (optional)</span><input id="rcTime" type="time" value="' + escapeHtml(r && r.time ? r.time : "") + '"></label>' +
      '<label><span>Repeats</span><select id="rcType">' +
        '<option value="daily"' + (r && r.type === "daily" ? " selected" : "") + ">Every day</option>" +
        '<option value="weekdays"' + (!r || r.type === "weekdays" ? " selected" : "") + ">Weekdays</option>" +
        '<option value="weekly"' + (r && r.type === "weekly" ? " selected" : "") + ">Weekly on chosen days</option>" +
        '<option value="monthly"' + (r && r.type === "monthly" ? " selected" : "") + ">Monthly on a day of the month</option>" +
      "</select></label>" +
      '<div id="rcWeekly" ' + (r && r.type === "weekly" ? "" : "hidden") + "><span class='hint'>Days</span><div>" +
        weekdayChecks(r ? r.weekdays : []) + "</div></div>" +
      '<label id="rcMonthly" ' + (r && r.type === "monthly" ? "" : "hidden") + "><span>Day of month</span>" +
        '<input id="rcMonthDay" type="number" min="1" max="31" value="' + escapeHtml(String(r && r.monthDay ? r.monthDay : 1)) + '"></label>',
      [
        { label: "Save", cls: "primary", onClick: function () {
          const titleV = document.getElementById("rcTitle").value.trim();
          if (!titleV) { document.getElementById("rcTitle").focus(); return; }
          const type = document.getElementById("rcType").value;
          const weekdays = Array.from(document.querySelectorAll(".wd:checked")).map(function (x) { return Number(x.value); });
          if (type === "weekly" && !weekdays.length) {
            toast("Choose at least one day of the week.");
            return;
          }
          const payload = {
            title: titleV,
            categoryId: document.getElementById("rcCat").value,
            priority: document.getElementById("rcPri").value,
            time: document.getElementById("rcTime").value,
            type: type,
            weekdays: weekdays,
            monthDay: Number(document.getElementById("rcMonthDay").value || 1),
            enabled: r ? r.enabled : true,
            startDate: r ? r.startDate : todayISO(),
            createdAt: r ? r.createdAt : nowStamp(),
            updatedAt: nowStamp()
          };
          if (r) Object.assign(r, payload);
          else { payload.id = uid(); state.recurring.push(payload); }
          persist();
          ensureInstancesForDate(viewDate);
          closeModal();
          render();
        }},
        { label: "Cancel", cls: "ghost", onClick: closeModal },
        r ? { label: "Delete", cls: "danger", onClick: function () {
          if (!confirm("Delete this repeating task? Existing items already on your lists will stay.")) return;
          state.recurring = state.recurring.filter(function (x) { return x.id !== r.id; });
          addTomb("recurring", r.id);
          persist();
          closeModal();
          render();
        }} : null
      ].filter(Boolean)
    );
    const typeSel = document.getElementById("rcType");
    function sync() {
      document.getElementById("rcWeekly").hidden = typeSel.value !== "weekly";
      document.getElementById("rcMonthly").hidden = typeSel.value !== "monthly";
    }
    typeSel.addEventListener("change", sync);
  }


  let pushTimer = 0;
  let pullTimer = 0;
  let syncing = false;
  let dirty = false;
  let syncStatus = "idle";
  let syncError = "";

  function formatStampCentral(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", {
      timeZone: TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }) + " Central";
  }

  function schedulePush() {
    if (!JournalSync.getToken()) return;
    dirty = true;
    renderSyncStatus();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { runSync("auto"); }, 3000);
  }

  function schedulePull(reason) {
    if (!JournalSync.getToken()) return;
    clearTimeout(pullTimer);
    pullTimer = setTimeout(function () { runSync(reason || "focus"); }, 400);
  }

  function applyMergedState(merged) {
    const demo = !!state.demo;
    state.categories = merged.categories;
    state.tasks = merged.tasks;
    state.recurring = merged.recurring;
    state.journal = merged.journal;
    state.skipped = merged.skipped;
    state.badgesEarned = merged.badgesEarned;
    state.settings = merged.settings;
    state.settingsTimes = merged.settingsTimes;
    state.tombstones = merged.tombstones;
    state.version = 2;
    state.demo = demo;
  }

  function runSync(reason) {
    const token = JournalSync.getToken();
    if (!token) return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      syncStatus = "offline";
      dirty = true;
      renderSyncStatus();
      return Promise.resolve();
    }
    if (syncing) {
      dirty = true;
      return Promise.resolve();
    }
    syncing = true;
    syncStatus = reason === "connect" ? "connecting" : "syncing";
    syncError = "";
    renderSyncStatus();

    const afterError = function (err) {
      syncStatus = "error";
      syncError = (err && err.message) ? String(err.message) : "Sync could not be completed.";
    };

    return Promise.resolve()
      .then(function () {
        const knownId = JournalSync.getGistId();
        if (!knownId) return null;
        return JournalSync.getGist(token, knownId).then(function (gist) {
          return { gist: gist, remote: JournalSync.readGistData(gist) };
        }).catch(function () {
          JournalSync.setGistId("");
          return null;
        });
      })
      .then(function (found) {
        if (found) return found;
        return JournalSync.findExistingGist(token).then(function (g) {
          if (!g) return null;
          JournalSync.setGistId(g.id);
          return JournalSync.getGist(token, g.id).then(function (gist) {
            return { gist: gist, remote: JournalSync.readGistData(gist) };
          });
        });
      })
      .then(function (found) {
        if (found && found.remote) {
          const merged = JournalSync.mergeStates(state, found.remote);
          applyMergedState(merged);
          persist({ skipPush: true });
          ensureInstancesForDate(todayISO());
          if (viewDate !== todayISO()) ensureInstancesForDate(viewDate);
          render();
        }
        const content = JSON.stringify(JournalSync.syncPayload(state), null, 2);
        if (!JournalSync.getGistId()) {
          return JournalSync.createGist(token, content).then(function (created) {
            if (created && created.id) JournalSync.setGistId(created.id);
          });
        }
        return JournalSync.patchGist(token, JournalSync.getGistId(), content);
      })
      .then(function () {
        dirty = false;
        JournalSync.setLastSync(nowStamp());
        syncStatus = "synced";
      })
      .catch(afterError)
      .then(function () {
        syncing = false;
        renderSyncStatus();
        if (dirty && JournalSync.getToken() && navigator.onLine) schedulePush();
      });
  }

  function connectSync() {
    const input = document.getElementById("syncTokenInput");
    const err = document.getElementById("syncConnectError");
    const token = (input.value || "").trim();
    err.textContent = "";
    if (!token) {
      err.textContent = "Paste your token first.";
      input.focus();
      return;
    }
    JournalSync.setToken(token);
    input.value = "";
    syncStatus = "connecting";
    renderSync();
    runSync("connect").then(function () {
      if (syncStatus === "error") {
        if (syncError.indexOf("not accepted") !== -1) JournalSync.clearToken();
        renderSync();
        return;
      }
      toast("This device is connected. Use a token from the same GitHub account on your other devices.");
      renderSync();
    });
  }

  function disconnectSync() {
    if (!confirm("Remove the token from this device? Your journal on this device and the copy in GitHub will stay as they are. Other devices stay connected.")) return;
    clearTimeout(pushTimer);
    clearTimeout(pullTimer);
    JournalSync.clearToken();
    JournalSync.setLastSync("");
    dirty = false;
    syncing = false;
    syncStatus = "idle";
    syncError = "";
    toast("The token was removed from this device. Your journal is still here.");
    renderSync();
    if (currentView === "more") renderMore();
  }

  function syncStatusText() {
    if (!JournalSync.getToken()) return "Not connected";
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "Offline — changes will sync when you are back online";
    }
    if (syncStatus === "connecting") return "Connecting…";
    if (syncStatus === "syncing") return "Syncing…";
    if (syncStatus === "error") return "Sync needs attention";
    if (dirty) return "Waiting to send your latest changes…";
    if (syncStatus === "synced" || JournalSync.getLastSync()) return "Connected";
    return "Connected";
  }

  function renderSyncStatus() {
    const line = document.getElementById("syncStatusLine");
    if (!line) return;
    const last = document.getElementById("syncLastLine");
    const mask = document.getElementById("syncTokenMask");
    const actions = document.getElementById("syncConnectedActions");
    const setup = document.getElementById("syncSetupCard");
    const errBox = document.getElementById("syncConnectError");
    const connected = !!JournalSync.getToken();
    const text = syncStatusText();
    line.textContent = text;
    line.className = "sync-status";
    if (syncStatus === "error") line.classList.add("err");
    else if (!connected) line.classList.add("warn");
    else if (typeof navigator !== "undefined" && navigator.onLine === false) line.classList.add("warn");
    else if (syncStatus === "synced" || connected) line.classList.add("ok");
    const lastIso = JournalSync.getLastSync();
    if (!connected) last.textContent = "";
    else if (lastIso) last.textContent = "Last synced " + formatStampCentral(lastIso);
    else last.textContent = "Not synced yet.";
    if (syncStatus === "error" && syncError) {
      last.textContent = (last.textContent ? last.textContent + " " : "") + syncError;
    }
    mask.textContent = connected ? ("The token stored on this device ends in " + JournalSync.maskToken(JournalSync.getToken()).replace(/^•+/, "")) : "";
    // maskToken already has bullets; say it more clearly:
    if (connected) mask.textContent = "The token stored on this device is " + JournalSync.maskToken(JournalSync.getToken());
    actions.hidden = !connected;
    if (setup) setup.hidden = connected;
    if (errBox && connected) errBox.textContent = "";
    if (errBox && !connected && syncStatus === "error") errBox.textContent = syncError;
    renderSyncSummary();
  }

  function renderSyncSummary() {
    const hint = document.getElementById("syncSummaryHint");
    if (!hint) return;
    if (!JournalSync.getToken()) {
      hint.textContent = "Keep the same journal on your computer, tablet and phone. You are not connected yet.";
      return;
    }
    const lastIso = JournalSync.getLastSync();
    const last = lastIso ? (" Last synced " + formatStampCentral(lastIso) + ".") : "";
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      hint.textContent = "Offline — changes will sync when you are back online." + last;
    } else if (syncStatus === "error") {
      hint.textContent = "Sync needs attention." + (syncError ? " " + syncError : "") + last;
    } else if (syncStatus === "syncing" || syncStatus === "connecting") {
      hint.textContent = syncStatusText() + last;
    } else {
      hint.textContent = "Connected to your private GitHub Gist." + last;
    }
  }

  function renderSync() {
    renderSyncStatus();
  }

  function exportBackup() {
    const payload = {
      app: "daily-journal",
      exportedAt: nowStamp(),
      timeZone: TZ,
      data: JournalSync.syncPayload(state).data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-daily-journal-" + todayISO() + ".json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("Backup file downloaded.");
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(reader.result);
        const data = parsed && parsed.data ? parsed.data : parsed;
        if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.categories)) {
          toast("That file is not a My Daily Journal backup.");
          return;
        }
        if (!confirm("Replace the journal on this device with the backup? This cannot be undone, except by importing another backup.")) return;
        state = Object.assign(defaultState(), data);
        if (!data.demo) state.demo = false;
        migrateState();
        persist();
        viewDate = todayISO();
        render();
        toast("Backup imported.");
      } catch (err) {
        toast("That file could not be read.");
      }
    };
    reader.readAsText(file);
  }

  function renderPrintWeek() {
    const days = weekDays(viewDate);
    const ws = weekStats(viewDate);
    let html = "<h1>My Daily Journal</h1>" +
      '<p class="print-meta">Week of ' + escapeHtml(formatMedium(days[0])) + " – " + escapeHtml(formatMedium(days[6])) +
      " · Central Time · " + ws.done + " of " + ws.total + " tasks finished (" + (ws.total ? ws.pct + "%" : "no tasks") + ")</p>";
    days.forEach(function (d) {
      const s = dayStats(d);
      const list = sortTasks(tasksForDate(d));
      const j = getJournal(d);
      html += '<div class="print-day"><h2>' + escapeHtml(formatLong(d)) +
        " · " + (s.hasTasks ? (s.done + " of " + s.total + " done") : "No tasks") + "</h2>";
      if (!list.length) html += "<p>No tasks.</p>";
      else {
        html += "<ul>" + list.map(function (t) {
          return "<li class='" + (t.done ? "print-done" : "") + "'>" + (t.done ? "☑ " : "☐ ") +
            escapeHtml(t.title) + (t.time ? " (" + escapeHtml(formatTime(t.time)) + ")" : "") + "</li>";
        }).join("") + "</ul>";
      }
      const bits = [];
      if (j.mood) bits.push("Mood: " + j.mood);
      if (j.energy) bits.push("Energy: " + j.energy);
      if (j.wins) bits.push("Wins: " + j.wins);
      if (j.grateful) bits.push("Grateful for: " + j.grateful);
      if (j.tomorrow) bits.push("Tomorrow's focus: " + j.tomorrow);
      if (j.notes) bits.push("Notes: " + j.notes);
      if (bits.length) html += "<p>" + bits.map(escapeHtml).join("<br>") + "</p>";
      html += "</div>";
    });
    const area = document.getElementById("printArea");
    area.innerHTML = html;
    area.hidden = false;
    window.print();
    setTimeout(function () { area.hidden = true; }, 500);
  }

  function showView(name) {
    if (VIEWS.indexOf(name) === -1) name = "today";
    currentView = name;
    document.querySelectorAll(".view").forEach(function (v) {
      v.hidden = v.getAttribute("data-view") !== name;
    });
    document.querySelectorAll(".tabbar .tab").forEach(function (b) {
      var v = b.getAttribute("data-view");
      b.classList.toggle("on", v === name || (name === "sync" && v === "more"));
    });
    const desired = "#" + name + (name === "progress" && progressTab !== "daily" ? "/" + progressTab : "");
    if (location.hash !== desired) history.replaceState(null, "", desired);
    render();
  }

  function applyHash() {
    const raw = (location.hash || "#today").replace(/^#/, "");
    const parts = raw.split("/");
    const name = parts[0];
    if (parts[1] && ["daily", "weekly", "monthly", "growth"].indexOf(parts[1]) !== -1) {
      progressTab = parts[1];
    }
    showView(name);
  }

  function render() {
    renderHeader();
    if (currentView === "today") renderToday();
    else if (currentView === "journal") renderJournal();
    else if (currentView === "progress") renderProgress();
    else if (currentView === "sync") renderSync();
    else renderMore();
  }

  function setTheme(mode) {
    if (mode === "system" || !mode) {
      try { localStorage.removeItem(THEME_KEY); } catch (err) {}
      document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      try { localStorage.setItem(THEME_KEY, mode); } catch (err) {}
      document.documentElement.dataset.theme = mode;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", document.documentElement.dataset.theme === "dark" ? "#121916" : "#1f4d38");
    renderHeader();
  }

  function bind() {
    document.getElementById("themeBtn").addEventListener("click", function () {
      const isDark = document.documentElement.dataset.theme === "dark";
      setTheme(isDark ? "light" : "dark");
    });
    document.getElementById("themeRow").addEventListener("click", function (e) {
      const b = e.target.closest("[data-theme-set]");
      if (b) setTheme(b.getAttribute("data-theme-set"));
    });

    document.querySelectorAll(".tabbar .tab").forEach(function (b) {
      b.addEventListener("click", function () { showView(b.getAttribute("data-view")); });
    });
    document.querySelectorAll(".subnav [data-progress]").forEach(function (b) {
      b.addEventListener("click", function () {
        progressTab = b.getAttribute("data-progress");
        if (!progressCursor) progressCursor = todayISO();
        history.replaceState(null, "", "#progress/" + progressTab);
        renderProgress();
      });
    });

    document.getElementById("prevDayBtn").addEventListener("click", function () { viewDate = addDays(viewDate, -1); renderToday(); });
    document.getElementById("nextDayBtn").addEventListener("click", function () { viewDate = addDays(viewDate, 1); renderToday(); });
    document.getElementById("jumpTodayBtn").addEventListener("click", function () { viewDate = todayISO(); renderToday(); });
    document.getElementById("jPrevDayBtn").addEventListener("click", function () { viewDate = addDays(viewDate, -1); renderJournal(); });
    document.getElementById("jNextDayBtn").addEventListener("click", function () { viewDate = addDays(viewDate, 1); renderJournal(); });
    document.getElementById("jJumpTodayBtn").addEventListener("click", function () { viewDate = todayISO(); renderJournal(); });

    document.getElementById("addForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const input = document.getElementById("taskInput");
      const title = input.value.trim();
      if (!title) { input.focus(); return; }
      addTask({
        title: title,
        categoryId: document.getElementById("taskCategory").value,
        priority: document.getElementById("taskPriority").value,
        time: document.getElementById("taskTime").value,
        date: viewDate
      });
      input.value = "";
      document.getElementById("taskTime").value = "";
      input.focus();
      renderToday();
    });

    document.getElementById("dismissSuggestBtn").addEventListener("click", function () {
      state.settings.suggestionsDismissed = true;
      state.settingsTimes.suggestionsDismissed = nowStamp();
      persist();
      renderSuggestions();
    });

    document.getElementById("addRecurringBtn").addEventListener("click", function () { openRecurringEditor(null); });
    document.getElementById("addCatForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const input = document.getElementById("newCatName");
      const name = input.value.trim();
      if (!name) return;
      const colors = ["#2f5d93", "#c2410c", "#1f8a54", "#7c3aed", "#be185d", "#0f766e", "#a16207", "#3f6212"];
      state.categories.push({ id: uid(), name: name, color: colors[state.categories.length % colors.length], updatedAt: nowStamp() });
      input.value = "";
      persist();
      fillCategorySelect();
      renderMore();
    });

    document.getElementById("exportBtn").addEventListener("click", exportBackup);
    document.getElementById("importBtn").addEventListener("click", function () {
      document.getElementById("importFile").click();
    });
    document.getElementById("importFile").addEventListener("change", function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) importBackup(f);
      e.target.value = "";
    });
    document.getElementById("printBtn").addEventListener("click", renderPrintWeek);

    document.getElementById("openSyncBtn").addEventListener("click", function () { showView("sync"); });
    document.getElementById("backToMoreBtn").addEventListener("click", function () { showView("more"); });
    document.getElementById("syncConnectForm").addEventListener("submit", function (e) {
      e.preventDefault();
      connectSync();
    });
    document.getElementById("syncNowBtn").addEventListener("click", function () { runSync("manual"); });
    document.getElementById("disconnectBtn").addEventListener("click", disconnectSync);

    bindJournalFields();
    window.addEventListener("hashchange", applyHash);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") schedulePull("focus");
    });
    window.addEventListener("focus", function () { schedulePull("focus"); });
    window.addEventListener("online", function () {
      if (JournalSync.getToken()) runSync("online");
    });
  }

  load();
  viewDate = todayISO();
  progressCursor = todayISO();
  fillCategorySelect();
  bind();
  applyHash();
  ensureInstancesForDate(todayISO());
  updateBadges();
  save();
  if (JournalSync.getToken()) runSync("open");

  window.__dj = {
    todayISO: todayISO,
    getState: function () { return state; },
    dayStats: dayStats,
    viewDate: function () { return viewDate; },
    mergeStates: JournalSync.mergeStates,
    runSync: function () { return runSync("manual"); },
    getSyncStatus: function () { return syncStatus; },
    applyMergedState: applyMergedState
  };
})();
