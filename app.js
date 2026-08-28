(() => {
  "use strict";

  const STORAGE_KEY = "hydra-water-v1";
  const DEFAULTS = {
    target: 3000,
    reminderStart: "08:00",
    reminderEnd: "20:00",
    entries: {}
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
    settingsForm: $("settingsForm"), customForm: $("customForm"),
    targetInput: $("targetInput"), startTimeInput: $("startTimeInput"), endTimeInput: $("endTimeInput"),
    customAmountInput: $("customAmountInput"), importInput: $("importInput")
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULTS),
        ...parsed,
        target: clampNumber(parsed.target, 500, 10000, 3000),
        entries: parsed.entries && typeof parsed.entries === "object" ? parsed.entries : {}
      };
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function dateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function dateFromKey(key) {
    const [y,m,d] = key.split("-").map(Number);
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

  function dayData(key) {
    if (!Array.isArray(state.entries[key])) state.entries[key] = [];
    return state.entries[key];
  }

  function totalFor(key) {
    return dayData(key).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }

  function formatMl(n) {
    return Math.round(n).toLocaleString("en-IN");
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(key, options = { day:"numeric", month:"short" }) {
    return dateFromKey(key).toLocaleDateString("en-IN", options);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  function addWater(amount) {
    const safe = clampNumber(amount, 50, 3000, 0);
    if (!safe) return;
    const key = dateKey();
    dayData(key).push({ amount: safe, at: new Date().toISOString() });
    saveState();
    render();
    showToast(`+${formatMl(safe)} ml added`);
  }

  function undoLast() {
    const key = dateKey();
    const entries = dayData(key);
    if (!entries.length) return;
    const removed = entries.pop();
    saveState();
    render();
    showToast(`Removed ${formatMl(removed.amount)} ml`);
  }

  function calculateStreak() {
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = dateKey(d);
      if (totalFor(key) >= state.target) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function renderToday() {
    const key = dateKey();
    const total = totalFor(key);
    const pct = Math.min(100, Math.round((total / state.target) * 100));
    const remaining = Math.max(0, state.target - total);
    const circumference = 2 * Math.PI * 48;
    const offset = circumference * (1 - pct / 100);

    els.todayLabel.textContent = new Date().toLocaleDateString("en-IN", {
      weekday:"long", day:"numeric", month:"long"
    });
    els.consumed.textContent = formatMl(total);
    els.targetLabel.textContent = `${formatMl(state.target)} ml`;
    els.progressPercent.textContent = `${pct}%`;
    els.ringValue.style.strokeDasharray = `${circumference}`;
    els.ringValue.style.strokeDashoffset = `${offset}`;
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
    els.undoBtn = $("undoBtn");
    els.undoBtn.disabled = entries.length === 0;

    if (!entries.length) {
      els.todayEntries.className = "entries empty-state";
      els.todayEntries.innerHTML = `<div class="empty-icon">🥤</div><p>No water logged yet.</p><small>Tap a quick-add button above to start.</small>`;
      return;
    }

    els.todayEntries.className = "entries";
    els.todayEntries.innerHTML = entries.map(e => `
      <div class="entry">
        <div class="entry-left">
          <div class="entry-icon">💧</div>
          <div>
            <div class="entry-time">${formatTime(e.at)}</div>
            <div class="entry-note">Logged today</div>
          </div>
        </div>
        <div class="entry-amount">+${formatMl(e.amount)} ml</div>
      </div>
    `).join("");
  }

  function renderWeek() {
    const keys = dayKeys(7);
    const values = keys.map(totalFor);
    const avg = values.reduce((a,b) => a+b, 0) / values.length;
    const best = Math.max(...values);
    const bestIndex = values.indexOf(best);
    const goals = values.filter(v => v >= state.target).length;
    const maxChart = Math.max(state.target, best, 1);

    els.weeklyAverage.textContent = `Avg ${formatMl(avg)} ml`;
    els.avgStat.textContent = `${formatMl(avg)} ml`;
    els.avgPercent.textContent = `${Math.round((avg / state.target) * 100)}% of target`;
    els.goalDays.textContent = goals;
    els.streakStat.textContent = calculateStreak();
    els.streakPill.textContent = `${calculateStreak()} day${calculateStreak() === 1 ? "" : "s"} at target`;

    if (best > 0) {
      els.bestDay.textContent = `${formatMl(best)} ml`;
      els.bestDayDate.textContent = formatDate(keys[bestIndex]);
    } else {
      els.bestDay.textContent = "—";
      els.bestDayDate.textContent = "No data yet";
    }

    els.weekChart.innerHTML = keys.map((key, i) => {
      const value = values[i];
      const height = Math.max(4, Math.min(100, (value / maxChart) * 100));
      const isToday = key === dateKey();
      const isGoal = value >= state.target;
      const dayLabel = dateFromKey(key).toLocaleDateString("en-IN", { weekday:"short" }).slice(0,2);
      return `
        <div class="day-col" title="${formatDate(key)}: ${formatMl(value)} ml">
          <div class="day-value">${value ? formatMl(value) : "—"}</div>
          <div class="day-bar-wrap"><div class="day-bar ${isToday ? "today" : ""} ${isGoal && !isToday ? "goal" : ""}" style="height:${height}%"></div></div>
          <div class="day-label">${dayLabel}</div>
        </div>
      `;
    }).join("");
  }

  function render() {
    renderToday();
    renderWeek();
  }

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

  function exportData() {
    const payload = {
      app: "Hydra Water Tracker",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        target: state.target,
        reminderStart: state.reminderStart,
        reminderEnd: state.reminderEnd
      },
      entries: state.entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
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
        if (!parsed || typeof parsed !== "object" || !parsed.entries || typeof parsed.entries !== "object") throw new Error();
        const cleanEntries = {};
        for (const [key, arr] of Object.entries(parsed.entries)) {
          if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(key) || !Array.isArray(arr)) continue;
          cleanEntries[key] = arr.map(e => ({
            amount: clampNumber(e.amount, 50, 3000, 0),
            at: typeof e.at === "string" ? e.at : new Date().toISOString()
          })).filter(e => e.amount > 0);
        }
        state = {
          ...structuredClone(DEFAULTS),
          target: clampNumber(parsed.settings?.target, 500, 10000, 3000),
          reminderStart: parsed.settings?.reminderStart || "08:00",
          reminderEnd: parsed.settings?.reminderEnd || "20:00",
          entries: cleanEntries
        };
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

  document.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => addWater(Number(btn.dataset.add)));
  });
  $("customForm").addEventListener("submit", (e) => {
    if (e.submitter?.id !== "addCustomBtn") return;
    e.preventDefault();
    const amount = clampNumber(els.customAmountInput.value, 50, 3000, 0);
    if (!amount) { showToast("Enter an amount first"); return; }
    addWater(amount);
    els.customAmountInput.value = "";
    els.customDialog.close();
  });
  $("customDialog").addEventListener("close", () => { els.customAmountInput.value = ""; });

  $("undoBtn").addEventListener("click", undoLast);
  $("settingsBtn").addEventListener("click", openSettings);
  $("editTargetBtn").addEventListener("click", openSettings);
  els.settingsForm.addEventListener("submit", (e) => {
    if (e.submitter?.id === "saveSettingsBtn") saveSettings(e);
  });

  $("backupBtn").addEventListener("click", () => els.backupDialog.showModal());
  $("closeBackupBtn").addEventListener("click", () => els.backupDialog.close());
  $("exportBtn").addEventListener("click", exportData);
  els.importInput.addEventListener("change", (e) => {
    if (e.target.files?.[0]) importData(e.target.files[0]);
  });
  $("clearDataBtn").addEventListener("click", () => {
    if (!confirm("Delete all Hydra data from this browser? This cannot be undone unless you have a backup.")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(DEFAULTS);
    render();
    els.backupDialog.close();
    showToast("Local data cleared");
  });

  // Keep the UI fresh if the app remains open across midnight.
  let lastDate = dateKey();
  setInterval(() => {
    const nowDate = dateKey();
    if (nowDate !== lastDate) {
      lastDate = nowDate;
      render();
    }
  }, 30000);

  render();
})();
