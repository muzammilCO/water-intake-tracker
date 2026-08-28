(() => {
  "use strict";

  const STORAGE_KEY = "hydra-water-v2";
  const DEFAULTS = {
    target: 3000,
    reminderStart: "08:00",
    reminderEnd: "20:00",
    entries: {},
    github: {
      owner: "",
      repo: "",
      branch: "main",
      path: "data/water-data.json",
      token: "",
      rememberToken: false
    }
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    todayLabel: $("todayLabel"), greeting: $("greeting"), statusText: $("statusText"),
    ringValue: $("ringValue"), progressPercent: $("progressPercent"),
    consumed: $("consumed"), targetLabel: $("targetLabel"), editTargetBtn: $("editTargetBtn"),
    progressBar: $("progressBar"), remainingLabel: $("remainingLabel"), goalLabel: $("goalLabel"),
    entryCount: $("entryCount"), streakPill: $("streakPill"), todayEntries: $("todayEntries"),
    weeklyAverage: $("weeklyAverage"), weekChart: $("weekChart"), bestDay: $("bestDay"),
    bestDayDate: $("bestDayDate"), avgStat: $("avgStat"), avgPercent: $("avgPercent"),
    goalDays: $("goalDays"), streakStat: $("streakStat"), toast: $("toast"),
    settingsDialog: $("settingsDialog"), customDialog: $("customDialog"), backupDialog: $("backupDialog"),
    syncDialog: $("syncDialog"), settingsForm: $("settingsForm"), customForm: $("customForm"),
    targetInput: $("targetInput"), startTimeInput: $("startTimeInput"), endTimeInput: $("endTimeInput"),
    customAmountInput: $("customAmountInput"), importInput: $("importInput"),
    syncOwner: $("syncOwner"), syncRepo: $("syncRepo"), syncBranch: $("syncBranch"),
    syncPath: $("syncPath"), syncToken: $("syncToken"), rememberToken: $("rememberToken"),
    syncStatus: $("syncStatus"), syncButton: $("syncButton"), fetchButton: $("fetchButton")
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function dateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function dateFromKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function dayKeys(count = 7, end = new Date()) {
    const out = [];
    const base = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      out.push(dateKey(d));
    }
    return out;
  }

  function makeId() {
    return (globalThis.crypto && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeEntry(e) {
    const amount = clampNumber(e?.amount, 50, 3000, 0);
    const at = typeof e?.at === "string" && !Number.isNaN(Date.parse(e.at))
      ? e.at : new Date().toISOString();
    return { id: String(e?.id || makeId()), amount, at };
  }

  function normalizeEntries(entries) {
    const clean = {};
    if (!entries || typeof entries !== "object") return clean;
    for (const [key, arr] of Object.entries(entries)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(arr)) continue;
      const seen = new Set();
      clean[key] = arr.map(normalizeEntry).filter(e => {
        if (!e.amount || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    }
    return clean;
  }

  function loadState() {
    let parsed = null;
    try { parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch {}
    if (parsed) {
      return {
        ...clone(DEFAULTS),
        ...parsed,
        target: clampNumber(parsed.target, 500, 10000, 3000),
        entries: normalizeEntries(parsed.entries),
        github: { ...clone(DEFAULTS.github), ...(parsed.github || {}), token: parsed.github?.rememberToken ? (parsed.github?.token || "") : "" }
      };
    }

    // One-time migration from v1 local-only storage.
    try {
      const legacy = JSON.parse(localStorage.getItem("hydra-water-v1") || "null");
      if (legacy) {
        const migrated = {
          ...clone(DEFAULTS),
          target: clampNumber(legacy.target, 500, 10000, 3000),
          reminderStart: legacy.reminderStart || "08:00",
          reminderEnd: legacy.reminderEnd || "20:00",
          entries: normalizeEntries(legacy.entries)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch {}

    return clone(DEFAULTS);
  }

  let state = loadState();
  let runtimeToken = state.github.token || "";

  function saveState() {
    const copy = clone(state);
    if (!copy.github.rememberToken) copy.github.token = "";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
  }

  function persistGithubConfig(c) {
    state.github = {
      owner: c.owner, repo: c.repo, branch: c.branch, path: c.path,
      token: c.rememberToken ? c.token : "",
      rememberToken: c.rememberToken
    };
    runtimeToken = c.token;
    saveState();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2500);
  }

  function setSyncStatus(message, kind = "") {
    els.syncStatus.textContent = message;
    els.syncStatus.className = `sync-status ${kind}`.trim();
  }

  function dayData(key) {
    if (!Array.isArray(state.entries[key])) state.entries[key] = [];
    return state.entries[key];
  }

  function totalFor(key) {
    return dayData(key).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }

  function formatMl(n) { return Math.round(n).toLocaleString("en-IN"); }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(key, options = { day: "numeric", month: "short" }) {
    return dateFromKey(key).toLocaleDateString("en-IN", options);
  }

  function addWater(amount) {
    const safe = clampNumber(amount, 50, 3000, 0);
    if (!safe) return;
    const key = dateKey();
    dayData(key).push({ id: makeId(), amount: safe, at: new Date().toISOString() });
    saveState();
    render();
    showToast(`+${formatMl(safe)} ml added`);
  }

  function undoLast() {
    const entries = dayData(dateKey());
    if (!entries.length) return;
    entries.pop();
    saveState();
    render();
    showToast("Last entry removed");
  }

  function calculateStreak() {
    let streak = 0;
    const d = new Date();
    while (totalFor(dateKey(d)) >= state.target) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function renderToday() {
    const key = dateKey();
    const total = totalFor(key);
    const pct = Math.min(100, Math.round((total / state.target) * 100));
    const remaining = Math.max(0, state.target - total);
    const circumference = 2 * Math.PI * 48;
    els.todayLabel.textContent = new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" });
    els.consumed.textContent = formatMl(total);
    els.targetLabel.textContent = `${formatMl(state.target)} ml`;
    els.progressPercent.textContent = `${pct}%`;
    els.ringValue.style.strokeDasharray = `${circumference}`;
    els.ringValue.style.strokeDashoffset = `${circumference * (1 - pct / 100)}`;
    els.progressBar.style.width = `${pct}%`;
    els.remainingLabel.textContent = remaining ? `${formatMl(remaining)} ml remaining` : "Daily target reached 🎉";
    els.goalLabel.textContent = `${formatMl(total)} / ${formatMl(state.target)} ml`;

    if (pct >= 100) {
      els.greeting.textContent = "Target complete. 💧";
      els.statusText.textContent = "Nice work — keep sipping normally.";
    } else if (pct >= 75) {
      els.greeting.textContent = "Almost there.";
      els.statusText.textContent = `${formatMl(remaining)} ml to your daily target.`;
    } else if (pct >= 40) {
      els.greeting.textContent = "Good progress.";
      els.statusText.textContent = "Keep the momentum going.";
    } else {
      els.greeting.textContent = "Stay hydrated.";
      els.statusText.textContent = "Every glass counts.";
    }

    const entries = [...dayData(key)].sort((a,b) => new Date(b.at) - new Date(a.at));
    els.entryCount.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
    $("undoBtn").disabled = entries.length === 0;

    if (!entries.length) {
      els.todayEntries.className = "entries empty-state";
      els.todayEntries.innerHTML = `<div class="empty-icon">🥤</div><p>No water logged yet.</p><small>Tap a quick-add button above to start.</small>`;
    } else {
      els.todayEntries.className = "entries";
      els.todayEntries.innerHTML = entries.map(e => `
        <div class="entry">
          <div class="entry-left">
            <div class="entry-icon">💧</div>
            <div><div class="entry-time">${formatTime(e.at)}</div><div class="entry-note">Logged today</div></div>
          </div>
          <div class="entry-amount">+${formatMl(e.amount)} ml</div>
        </div>
      `).join("");
    }
  }

  function renderWeek() {
    const keys = dayKeys(7);
    const values = keys.map(totalFor);
    const avg = values.reduce((a,b) => a+b, 0) / values.length;
    const best = Math.max(...values);
    const bestIndex = values.indexOf(best);
    const goals = values.filter(v => v >= state.target).length;
    const maxChart = Math.max(state.target, best, 1);
    const streak = calculateStreak();

    els.weeklyAverage.textContent = `Avg ${formatMl(avg)} ml`;
    els.avgStat.textContent = `${formatMl(avg)} ml`;
    els.avgPercent.textContent = `${Math.round((avg / state.target) * 100)}% of target`;
    els.goalDays.textContent = goals;
    els.streakStat.textContent = streak;
    els.streakPill.textContent = `${streak} day${streak === 1 ? "" : "s"} at target`;
    els.bestDay.textContent = best ? `${formatMl(best)} ml` : "—";
    els.bestDayDate.textContent = best ? formatDate(keys[bestIndex]) : "No data yet";

    els.weekChart.innerHTML = keys.map((key, i) => {
      const value = values[i];
      const height = Math.max(4, Math.min(100, (value / maxChart) * 100));
      const isToday = key === dateKey();
      const isGoal = value >= state.target;
      const label = dateFromKey(key).toLocaleDateString("en-IN", { weekday:"short" }).slice(0,2);
      return `<div class="day-col" title="${formatDate(key)}: ${formatMl(value)} ml">
        <div class="day-value">${value ? formatMl(value) : "—"}</div>
        <div class="day-bar-wrap"><div class="day-bar ${isToday ? "today" : ""} ${isGoal && !isToday ? "goal" : ""}" style="height:${height}%"></div></div>
        <div class="day-label">${label}</div>
      </div>`;
    }).join("");
  }

  function render() { renderToday(); renderWeek(); }

  function openSettings() {
    els.targetInput.value = state.target;
    els.startTimeInput.value = state.reminderStart;
    els.endTimeInput.value = state.reminderEnd;
    els.settingsDialog.showModal();
  }

  function saveSettings(e) {
    e.preventDefault();
    state.target = clampNumber(els.targetInput.value, 500, 10000, 3000);
    state.reminderStart = els.startTimeInput.value || "08:00";
    state.reminderEnd = els.endTimeInput.value || "20:00";
    saveState();
    els.settingsDialog.close();
    render();
    showToast("Settings saved");
  }

  function openSync() {
    els.syncOwner.value = state.github.owner;
    els.syncRepo.value = state.github.repo;
    els.syncBranch.value = state.github.branch || "main";
    els.syncPath.value = state.github.path || "data/water-data.json";
    els.syncToken.value = runtimeToken || "";
    els.rememberToken.checked = Boolean(state.github.rememberToken);
    setSyncStatus("Enter your private-repo details. Your token never goes into the repository.");
    els.syncDialog.showModal();
  }

  function getConfig() {
    return {
      owner: els.syncOwner.value.trim(),
      repo: els.syncRepo.value.trim(),
      branch: els.syncBranch.value.trim() || "main",
      path: els.syncPath.value.trim().replace(/^\/+/, "") || "data/water-data.json",
      token: els.syncToken.value.trim(),
      rememberToken: els.rememberToken.checked
    };
  }

  function validateConfig(c) {
    if (!c.owner || !c.repo || !c.token) throw new Error("Enter GitHub owner, repository, and fine-grained token.");
    if (/\s/.test(c.owner) || /\s/.test(c.repo) || /\s/.test(c.branch) || /\s/.test(c.path)) throw new Error("GitHub fields cannot contain spaces.");
    if (c.path.includes("..")) throw new Error("Data path cannot contain '..'.");
  }

  function apiHeaders(token) {
    return {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function contentsUrl(c) {
    const encodedPath = c.path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(c.branch)}`;
  }

  async function requestJson(url, options) {
    const res = await fetch(url, options);
    let body = null;
    try { body = await res.json(); } catch {}
    if (!res.ok) {
      const message = body?.message || `${res.status} ${res.statusText}`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  async function fetchRemote(c) {
    const payload = await requestJson(contentsUrl(c), { headers: apiHeaders(c.token) });
    if (!payload.content) throw new Error("GitHub returned no file content.");
    const binary = atob(payload.content.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error("data/water-data.json is not valid JSON."); }
    return { sha: payload.sha || null, entries: normalizeEntries(parsed.entries || parsed) };
  }

  async function fetchRemoteAllowMissing(c) {
    try { return await fetchRemote(c); }
    catch (e) {
      if (e.status === 404) return { sha: null, entries: {} };
      if (e.status === 401) throw new Error("GitHub rejected the token. Recheck the fine-grained token.");
      if (e.status === 403) throw new Error("GitHub denied access. The token needs Contents: Read and write for this repository.");
      throw e;
    }
  }

  function mergeEntries(a, b) {
    const result = {};
    const left = normalizeEntries(a);
    const right = normalizeEntries(b);
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      const map = new Map();
      for (const e of [...(left[key] || []), ...(right[key] || [])]) {
        const n = normalizeEntry(e);
        map.set(n.id, n);
      }
      result[key] = [...map.values()].sort((x,y) => Date.parse(x.at) - Date.parse(y.at));
    }
    return result;
  }

  function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  async function saveRemote(c, entries, sha) {
    const encodedPath = c.path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    const url = `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${encodedPath}`;
    const body = {
      message: `Hydra sync: ${new Date().toISOString()}`,
      content: encodeBase64Utf8(JSON.stringify({
        app: "Hydra Water Tracker",
        schemaVersion: 2,
        updatedAt: new Date().toISOString(),
        entries
      }, null, 2)),
      branch: c.branch
    };
    if (sha) body.sha = sha;
    return requestJson(url, {
      method: "PUT",
      headers: { ...apiHeaders(c.token), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async function syncAndMerge() {
    const c = getConfig();
    try {
      validateConfig(c);
      els.syncButton.disabled = true;
      els.fetchButton.disabled = true;

      setSyncStatus("Fetching shared history…", "busy");
      const remote = await fetchRemoteAllowMissing(c);
      const merged = mergeEntries(state.entries, remote.entries);

      setSyncStatus("Saving merged history…", "busy");
      try {
        await saveRemote(c, merged, remote.sha);
      } catch (e) {
        if (e.status !== 409) throw e;
        setSyncStatus("Another device changed the file. Merging again…", "busy");
        const fresh = await fetchRemoteAllowMissing(c);
        const mergedFresh = mergeEntries(merged, fresh.entries);
        await saveRemote(c, mergedFresh, fresh.sha);
        state.entries = mergedFresh;
      }

      state.entries = merged;
      persistGithubConfig(c);
      render();
      setSyncStatus("Synced successfully. Both local and GitHub history are up to date.", "success");
      showToast("Synced across devices ✓");
    } catch (e) {
      setSyncStatus(e.message || "Sync failed.", "error");
    } finally {
      els.syncButton.disabled = false;
      els.fetchButton.disabled = false;
    }
  }

  async function fetchOnly() {
    const c = getConfig();
    try {
      validateConfig(c);
      els.syncButton.disabled = true;
      els.fetchButton.disabled = true;
      setSyncStatus("Fetching shared history…", "busy");
      const remote = await fetchRemoteAllowMissing(c);
      state.entries = remote.entries;
      persistGithubConfig(c);
      render();
      setSyncStatus(`Fetched ${Object.keys(remote.entries).length} day(s) from GitHub.`, "success");
      showToast("Shared history loaded");
    } catch (e) {
      setSyncStatus(e.message || "Fetch failed.", "error");
    } finally {
      els.syncButton.disabled = false;
      els.fetchButton.disabled = false;
    }
  }

  function exportData() {
    const payload = {
      app: "Hydra Water Tracker", version: 2, exportedAt: new Date().toISOString(),
      settings: { target: state.target, reminderStart: state.reminderStart, reminderEnd: state.reminderEnd },
      entries: state.entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hydra-backup-${dateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed?.entries || typeof parsed.entries !== "object") throw new Error();
        state.entries = normalizeEntries(parsed.entries);
        state.target = clampNumber(parsed.settings?.target, 500, 10000, state.target);
        saveState();
        render();
        els.backupDialog.close();
        showToast("Backup restored");
      } catch {
        showToast("That backup file isn't valid");
      }
      els.importInput.value = "";
    };
    reader.readAsText(file);
  }

  document.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", () => addWater(Number(btn.dataset.add))));
  $("customAddBtn").addEventListener("click", () => { els.customAmountInput.value = ""; els.customDialog.showModal(); });
  els.customForm.addEventListener("submit", (e) => {
    if (e.submitter?.id !== "addCustomBtn") return;
    e.preventDefault();
    const amount = clampNumber(els.customAmountInput.value, 50, 3000, 0);
    if (!amount) return showToast("Enter an amount first");
    addWater(amount);
    els.customDialog.close();
  });
  $("undoBtn").addEventListener("click", undoLast);
  $("settingsBtn").addEventListener("click", openSettings);
  $("editTargetBtn").addEventListener("click", openSettings);
  els.settingsForm.addEventListener("submit", (e) => { if (e.submitter?.id === "saveSettingsBtn") saveSettings(e); });
  $("backupBtn").addEventListener("click", () => els.backupDialog.showModal());
  $("closeBackupBtn").addEventListener("click", () => els.backupDialog.close());
  $("exportBtn").addEventListener("click", exportData);
  els.importInput.addEventListener("change", e => { if (e.target.files?.[0]) importData(e.target.files[0]); });
  $("clearDataBtn").addEventListener("click", () => {
    if (!confirm("Delete all Hydra data from this browser? This cannot be undone unless backed up or synced.")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("hydra-water-v1");
    state = clone(DEFAULTS);
    runtimeToken = "";
    render();
    els.backupDialog.close();
    showToast("Local data cleared");
  });

  $("syncSettingsBtn").addEventListener("click", openSync);
  $("closeSyncBtn").addEventListener("click", () => els.syncDialog.close());
  $("syncButton").addEventListener("click", syncAndMerge);
  $("fetchButton").addEventListener("click", fetchOnly);
  $("syncHelpBtn").addEventListener("click", () => {
    setSyncStatus("Create a fine-grained token limited to this repo with Contents → Read and write. Your token is used only from this browser.", "info");
  });

  let lastDate = dateKey();
  setInterval(() => {
    const now = dateKey();
    if (now !== lastDate) { lastDate = now; render(); }
  }, 30000);

  render();
})();
