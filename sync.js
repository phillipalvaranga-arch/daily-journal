/* My Daily Journal — private Gist sync.
   The access token is never logged, never exported, and is sent only to api.github.com. */
(function (root) {
  "use strict";

  var API = "https://api.github.com";
  var GIST_DESC = "My Daily Journal Sync";
  var GIST_FILE = "journal-data.json";
  var TOKEN_KEY = "dj-sync-token";
  var GIST_ID_KEY = "dj-sync-gist-id";
  var LAST_KEY = "dj-sync-last";

  function emptyTombs() {
    return { tasks: {}, recurring: {}, categories: {}, journal: {}, skipped: {} };
  }

  function stampOf(item) {
    if (!item || typeof item !== "object") return "";
    return item.updatedAt || item.createdAt || "";
  }

  function laterStamp(a, b) {
    if (!a) return b || "";
    if (!b) return a;
    return a >= b ? a : b;
  }

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function mergeTombMaps(a, b) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) {
      out[k] = laterStamp(out[k], b[k]);
    });
    return out;
  }

  function mergeById(localList, remoteList, localTombs, remoteTombs) {
    var tombs = mergeTombMaps(localTombs, remoteTombs);
    var map = {};
    (localList || []).concat(remoteList || []).forEach(function (item) {
      if (!item || !item.id) return;
      var cur = map[item.id];
      if (!cur || stampOf(item) > stampOf(cur)) map[item.id] = item;
    });
    var list = [];
    var leftover = {};
    Object.keys(tombs).forEach(function (id) { leftover[id] = tombs[id]; });
    Object.keys(map).forEach(function (id) {
      var item = map[id];
      var tomb = tombs[id] || "";
      if (tomb && tomb >= stampOf(item)) return;
      list.push(item);
      delete leftover[id];
    });
    return { list: list, tombstones: leftover };
  }

  var JOURNAL_FIELDS = ["notes", "wins", "grateful", "tomorrow", "mood", "energy"];

  function fieldTime(entry, field) {
    if (!entry) return "";
    if (entry.fieldTimes && entry.fieldTimes[field]) return entry.fieldTimes[field];
    return entry.updatedAt || "";
  }

  function mergeJournal(localJ, remoteJ, localTombs, remoteTombs) {
    var tombs = mergeTombMaps(localTombs, remoteTombs);
    var dates = {};
    Object.keys(localJ || {}).forEach(function (d) { dates[d] = true; });
    Object.keys(remoteJ || {}).forEach(function (d) { dates[d] = true; });
    var out = {};
    var leftover = {};
    Object.keys(tombs).forEach(function (d) { leftover[d] = tombs[d]; });
    Object.keys(dates).forEach(function (d) {
      var L = (localJ || {})[d];
      var R = (remoteJ || {})[d];
      var stamp = laterStamp(stampOf(L), stampOf(R));
      var tomb = tombs[d] || "";
      if (tomb && tomb >= stamp && !((stampOf(L) > tomb) || (stampOf(R) > tomb))) {
        return;
      }
      if (tomb && stamp > tomb) delete leftover[d];
      else if (!tomb) delete leftover[d];
      if (!L) { out[d] = R; return; }
      if (!R) { out[d] = L; return; }
      var merged = Object.assign({}, stampOf(L) >= stampOf(R) ? L : R);
      merged.fieldTimes = Object.assign({}, L.fieldTimes || {}, R.fieldTimes || {});
      JOURNAL_FIELDS.forEach(function (f) {
        var lt = fieldTime(L, f);
        var rt = fieldTime(R, f);
        if (rt && rt > lt) {
          merged[f] = R[f];
          merged.fieldTimes[f] = rt;
        } else if (lt) {
          merged[f] = L[f];
          merged.fieldTimes[f] = lt;
        }
      });
      merged.updatedAt = laterStamp(stampOf(L), stampOf(R));
      out[d] = merged;
      delete leftover[d];
    });
    return { journal: out, tombstones: leftover };
  }

  function normalizeSkip(entry) {
    if (entry === true) return { value: true, updatedAt: "" };
    if (entry === false || entry == null) return { value: false, updatedAt: "" };
    return { value: !!entry.value, updatedAt: entry.updatedAt || "" };
  }

  function mergeSkipped(localS, remoteS, localTombs, remoteTombs) {
    var tombs = mergeTombMaps(localTombs, remoteTombs);
    function flatten(src, bag) {
      Object.keys(src || {}).forEach(function (rid) {
        var row = src[rid] || {};
        Object.keys(row).forEach(function (day) {
          bag[rid + "|" + day] = { rid: rid, day: day, entry: normalizeSkip(row[day]) };
        });
      });
    }
    var bag = {};
    var remoteBag = {};
    flatten(localS, bag);
    flatten(remoteS, remoteBag);
    Object.keys(remoteBag).forEach(function (k) {
      if (!bag[k] || remoteBag[k].entry.updatedAt > bag[k].entry.updatedAt) bag[k] = remoteBag[k];
    });
    var leftover = {};
    Object.keys(tombs).forEach(function (k) { leftover[k] = tombs[k]; });
    var out = {};
    Object.keys(bag).forEach(function (k) {
      var rec = bag[k];
      var tomb = tombs[k] || "";
      if (tomb && tomb >= (rec.entry.updatedAt || "")) return;
      delete leftover[k];
      if (!out[rec.rid]) out[rec.rid] = {};
      out[rec.rid][rec.day] = rec.entry;
    });
    return { skipped: out, tombstones: leftover };
  }

  function mergeSettings(localS, remoteS, localTimes, remoteTimes) {
    var keys = {};
    Object.keys(localS || {}).forEach(function (k) { keys[k] = true; });
    Object.keys(remoteS || {}).forEach(function (k) { keys[k] = true; });
    var values = {};
    var times = {};
    Object.keys(keys).forEach(function (k) {
      var lt = (localTimes || {})[k] || "";
      var rt = (remoteTimes || {})[k] || "";
      if (rt > lt) {
        values[k] = (remoteS || {})[k];
        times[k] = rt;
      } else {
        values[k] = (localS || {})[k];
        times[k] = lt || rt;
      }
    });
    return { settings: values, settingsTimes: times };
  }

  function mergeBadges(a, b) {
    var out = Object.assign({}, a || {});
    Object.keys(b || {}).forEach(function (id) {
      if (!out[id] || (b[id] && b[id] < out[id])) out[id] = b[id];
    });
    return out;
  }

  function dedupeRecurringTasks(tasks, tombs) {
    var best = {};
    (tasks || []).forEach(function (t, i) {
      if (!t || !t.recurringId || !t.date) return;
      var k = t.recurringId + "|" + t.date;
      var cur = best[k];
      if (!cur || stampOf(t) > stampOf(cur.item)) best[k] = { item: t, index: i };
    });
    var drop = {};
    (tasks || []).forEach(function (t) {
      if (!t || !t.recurringId || !t.date) return;
      var k = t.recurringId + "|" + t.date;
      if (best[k] && best[k].item.id !== t.id) drop[t.id] = laterStamp(stampOf(t), stampOf(best[k].item));
    });
    var list = (tasks || []).filter(function (t) { return t && !drop[t.id]; });
    var nextTombs = Object.assign({}, tombs || {});
    Object.keys(drop).forEach(function (id) { nextTombs[id] = laterStamp(nextTombs[id], drop[id]); });
    return { list: list, tombstones: nextTombs };
  }

  function mergeStates(local, remote) {
    local = local || {};
    remote = remote || {};
    var lt = local.tombstones || emptyTombs();
    var rt = remote.tombstones || emptyTombs();
    var tasksM = mergeById(local.tasks, remote.tasks, lt.tasks, rt.tasks);
    var deduped = dedupeRecurringTasks(tasksM.list, tasksM.tombstones);
    var recM = mergeById(local.recurring, remote.recurring, lt.recurring, rt.recurring);
    var catM = mergeById(local.categories, remote.categories, lt.categories, rt.categories);
    var jourM = mergeJournal(local.journal, remote.journal, lt.journal, rt.journal);
    var skipM = mergeSkipped(local.skipped, remote.skipped, lt.skipped, rt.skipped);
    var setM = mergeSettings(local.settings, remote.settings, local.settingsTimes, remote.settingsTimes);
    if (!catM.list.length) {
      catM.list = (local.categories && local.categories.length) ? local.categories : (remote.categories || []);
    }
    return {
      version: 2,
      categories: catM.list,
      tasks: deduped.list,
      recurring: recM.list,
      journal: jourM.journal,
      skipped: skipM.skipped,
      badgesEarned: mergeBadges(local.badgesEarned, remote.badgesEarned),
      settings: setM.settings,
      settingsTimes: setM.settingsTimes,
      tombstones: {
        tasks: deduped.tombstones,
        recurring: recM.tombstones,
        categories: catM.tombstones,
        journal: jourM.tombstones,
        skipped: skipM.tombstones
      }
    };
  }

  function syncPayload(state) {
    var data = {
      version: 2,
      categories: state.categories || [],
      tasks: state.tasks || [],
      recurring: state.recurring || [],
      journal: state.journal || {},
      skipped: state.skipped || {},
      badgesEarned: state.badgesEarned || {},
      settings: state.settings || {},
      settingsTimes: state.settingsTimes || {},
      tombstones: state.tombstones || emptyTombs()
    };
    return {
      app: "daily-journal",
      version: 2,
      updatedAt: new Date().toISOString(),
      data: data
    };
  }

  function parsePayload(raw) {
    if (!raw) return null;
    var parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && parsed.data) return parsed.data;
    if (parsed && Array.isArray(parsed.tasks)) return parsed;
    return null;
  }

  function maskToken(token) {
    var t = String(token || "");
    if (t.length < 8) return "••••";
    return "••••" + t.slice(-4);
  }

  function readStore(key) {
    try { return localStorage.getItem(key) || ""; } catch (e) { return ""; }
  }
  function writeStore(key, val) {
    try {
      if (val == null || val === "") localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch (e) {}
  }

  function getToken() { return readStore(TOKEN_KEY); }
  function setToken(token) {
    var t = String(token || "").trim();
    writeStore(TOKEN_KEY, t);
  }
  function clearToken() {
    writeStore(TOKEN_KEY, "");
    writeStore(GIST_ID_KEY, "");
  }
  function getGistId() { return readStore(GIST_ID_KEY); }
  function setGistId(id) { writeStore(GIST_ID_KEY, id || ""); }
  function getLastSync() { return readStore(LAST_KEY); }
  function setLastSync(iso) { writeStore(LAST_KEY, iso || ""); }

  function parseNextLink(link) {
    if (!link) return "";
    var parts = link.split(",");
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/<([^>]+)>;\s*rel="next"/);
      if (m) return m[1];
    }
    return "";
  }

  function apiUrlOk(url) {
    try {
      return new URL(url, API).origin === API;
    } catch (e) {
      return false;
    }
  }

  function gh(token, url, opts) {
    if (!apiUrlOk(url)) return Promise.reject(new Error("Sync can only talk to api.github.com"));
    opts = opts || {};
    var headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(url, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body || undefined
    });
  }

  function statusError(res) {
    if (res.status === 401 || res.status === 403) {
      return "That token was not accepted. Check that you copied the whole token and that it has the gist permission.";
    }
    if (res.status === 404) return "The synced copy could not be found. Try connecting again.";
    if (res.status === 422) return "GitHub could not save the synced copy. Try again in a moment.";
    return "GitHub returned an error (" + res.status + "). Try again in a moment.";
  }

  function listGists(token) {
    var all = [];
    function page(url) {
      return gh(token, url).then(function (res) {
        if (!res.ok) return Promise.reject(new Error(statusError(res)));
        return res.json().then(function (items) {
          if (Array.isArray(items)) all = all.concat(items);
          var next = parseNextLink(res.headers.get("Link"));
          if (next && apiUrlOk(next)) return page(next);
          return all;
        });
      });
    }
    return page(API + "/gists?per_page=100");
  }

  function findExistingGist(token) {
    return listGists(token).then(function (gists) {
      var matches = (gists || []).filter(function (g) {
        if (!g || g.description !== GIST_DESC) return false;
        if (g.files && g.files[GIST_FILE]) return true;
        return !!g.files;
      });
      matches.sort(function (a, b) {
        return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
      });
      return matches[0] || null;
    });
  }

  function createGist(token, content) {
    return gh(token, API + "/gists", {
      method: "POST",
      body: JSON.stringify({
        description: GIST_DESC,
        public: false,
        files: { "journal-data.json": { content: content } }
      })
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error(statusError(res)));
      return res.json();
    });
  }

  function getGist(token, id) {
    return gh(token, API + "/gists/" + encodeURIComponent(id)).then(function (res) {
      if (!res.ok) return Promise.reject(new Error(statusError(res)));
      return res.json();
    });
  }

  function readGistData(gist) {
    if (!gist || !gist.files) return null;
    var file = gist.files[GIST_FILE] || gist.files[Object.keys(gist.files)[0]];
    if (!file) return null;
    if (file.truncated) {
      throw new Error("The synced copy is too large to read through GitHub's API. Export a backup from each device and contact support if this continues.");
    }
    if (!file.content) return null;
    return parsePayload(file.content);
  }

  function patchGist(token, id, content) {
    return gh(token, API + "/gists/" + encodeURIComponent(id), {
      method: "PATCH",
      body: JSON.stringify({
        files: { "journal-data.json": { content: content } }
      })
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error(statusError(res)));
      return res.json();
    });
  }

  var JournalSync = {
    GIST_DESC: GIST_DESC,
    GIST_FILE: GIST_FILE,
    TOKEN_KEY: TOKEN_KEY,
    GIST_ID_KEY: GIST_ID_KEY,
    LAST_KEY: LAST_KEY,
    emptyTombs: emptyTombs,
    stampOf: stampOf,
    mergeStates: mergeStates,
    mergeById: mergeById,
    mergeJournal: mergeJournal,
    syncPayload: syncPayload,
    parsePayload: parsePayload,
    maskToken: maskToken,
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    getGistId: getGistId,
    setGistId: setGistId,
    getLastSync: getLastSync,
    setLastSync: setLastSync,
    findExistingGist: findExistingGist,
    createGist: createGist,
    getGist: getGist,
    readGistData: readGistData,
    patchGist: patchGist,
    listGists: listGists
  };

  if (typeof module !== "undefined" && module.exports) module.exports = JournalSync;
  root.JournalSync = JournalSync;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
