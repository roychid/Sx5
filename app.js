const STORAGE_KEYS = {
  season: "sx5:season-squad:v1",
  matchweek1: "sx5:matchweek:1:v1",
};

const TEAM_DATA_ROOT = "./data/teams";
const leagueUrl = "./data/league.json";

const state = {
  league: null,
  teamsById: new Map(),
  teamsBySlug: new Map(),
  teamCache: new Map(),
  mode: "season",
  seasonSquad: [],
  matchweekSquad: [],
  activeSlot: null,
  draggedSlot: null,
  currentPickerTeam: "manchester-city",
};

const els = {
  slots: [...document.querySelectorAll(".slot")],
  selectedCount: document.querySelector("#selectedCount"),
  summarySelected: document.querySelector("#summarySelected"),
  clubCount: document.querySelector("#clubCount"),
  changeCount: document.querySelector("#changeCount"),
  builderModeLabel: document.querySelector("#builderModeLabel"),
  builderTitle: document.querySelector("#builderTitle"),
  summaryTitle: document.querySelector("#summaryTitle"),
  saveBtn: document.querySelector("#saveBtn"),
  generateBtn: document.querySelector("#generateBtn"),
  restoreBtn: document.querySelector("#restoreBtn"),
  saveNote: document.querySelector("#saveNote"),
  seasonModeBtn: document.querySelector("#seasonModeBtn"),
  matchweekModeBtn: document.querySelector("#matchweekModeBtn"),
  resetAllBtn: document.querySelector("#resetAllBtn"),
  dialog: document.querySelector("#playerDialog"),
  dialogHeading: document.querySelector("#dialogHeading"),
  teamSelect: document.querySelector("#teamSelect"),
  playerSearch: document.querySelector("#playerSearch"),
  playerList: document.querySelector("#playerList"),
  pickerMeta: document.querySelector("#pickerMeta"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  cancelDialogBtn: document.querySelector("#cancelDialogBtn"),
  removePlayerBtn: document.querySelector("#removePlayerBtn"),
  toast: document.querySelector("#toast"),
};

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getActiveSquad() {
  return state.mode === "season" ? state.seasonSquad : state.matchweekSquad;
}

function setActiveSquad(next) {
  if (state.mode === "season") state.seasonSquad = next;
  else state.matchweekSquad = next;
}

function normalizeSquad(value) {
  if (!Array.isArray(value)) return [];
  const seenPlayers = new Set();
  const seenSlots = new Set();
  return value
    .filter((entry) => entry && Number.isInteger(entry.slot) && entry.slot >= 0 && entry.slot <= 9 && entry.player)
    .filter((entry) => {
      const key = `${entry.teamId}:${entry.player.id}`;
      if (seenPlayers.has(key) || seenSlots.has(entry.slot)) return false;
      seenPlayers.add(key);
      seenSlots.add(entry.slot);
      return true;
    })
    .slice(0, 5);
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function cloneSquad(squad) {
  return squad.map((entry) => ({
    slot: entry.slot,
    teamId: entry.teamId,
    teamSlug: entry.teamSlug,
    teamCode: entry.teamCode,
    teamName: entry.teamName,
    teamColors: { ...entry.teamColors },
    player: { ...entry.player, detailedPositions: [...(entry.player.detailedPositions || [])] },
  }));
}

function entryFor(team, player, slot) {
  return {
    slot,
    teamId: team.id,
    teamSlug: team.slug,
    teamCode: team.code,
    teamName: team.name,
    teamColors: {
      primary: team.primaryColor || "#25382b",
      secondary: team.secondaryColor || "#131b16",
      text: team.textColor || "#ffffff",
    },
    player: {
      id: player.id,
      name: player.name,
      shortName: player.shortName || player.name,
      positionGroup: player.positionGroup || "?",
      detailedPositions: player.detailedPositions || [],
      shirtNumber: player.shirtNumber ?? null,
    },
  };
}

async function loadLeague() {
  const response = await fetch(leagueUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${leagueUrl}`);
  state.league = await response.json();
  state.teamsById = new Map(state.league.teams.map((team) => [team.id, team]));
  state.teamsBySlug = new Map(state.league.teams.map((team) => [team.slug, team]));

  els.teamSelect.innerHTML = state.league.teams
    .map((team) => `<option value="${team.slug}">${team.name}</option>`)
    .join("");
  els.teamSelect.value = state.currentPickerTeam;
}

async function loadTeam(slug) {
  if (state.teamCache.has(slug)) return state.teamCache.get(slug);
  const response = await fetch(`${TEAM_DATA_ROOT}/${slug}.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load squad: ${slug}`);
  const data = await response.json();
  state.teamCache.set(slug, data);
  return data;
}

async function getDemoSquad() {
  const [city, arsenal] = await Promise.all([loadTeam("manchester-city"), loadTeam("arsenal")]);
  const wanted = [
    [city, "Erling Haaland", 0],
    [city, "Phil Foden", 2],
    [city, "Rodri", 4],
    [arsenal, "Bukayo Saka", 6],
    [arsenal, "Declan Rice", 8],
  ];

  return wanted.flatMap(([data, name, slot]) => {
    const player = data.players.find((candidate) => candidate.name === name);
    return player ? [entryFor(data.team, player, slot)] : [];
  });
}

function renderSlot(slotEl, entry) {
  const slot = Number(slotEl.dataset.slot);
  slotEl.classList.toggle("has-player", Boolean(entry));
  slotEl.innerHTML = "";

  if (!entry) {
    const button = document.createElement("button");
    button.className = "empty-slot";
    button.type = "button";
    button.setAttribute("aria-label", `Add player at position ${slot + 1}`);
    button.innerHTML = `<span>+</span>`;
    button.addEventListener("click", () => openPicker(slot));
    slotEl.append(button);
    return;
  }

  const button = document.createElement("button");
  button.className = "player-card";
  button.type = "button";
  button.draggable = true;
  button.style.setProperty("--club-primary", entry.teamColors.primary);
  button.style.setProperty("--club-secondary", entry.teamColors.secondary);
  button.style.setProperty("--club-text", entry.teamColors.text);
  const position = entry.player.detailedPositions?.[0] || entry.player.positionGroup || "PLAYER";
  button.innerHTML = `
    <span class="player-avatar">${initials(entry.player.shortName || entry.player.name)}</span>
    <span class="player-name">${escapeHtml(entry.player.shortName || entry.player.name)}</span>
    <span class="player-meta">${escapeHtml(entry.teamCode)}${entry.player.shirtNumber ? ` · #${entry.player.shirtNumber}` : ""}</span>
    <span class="player-position">${escapeHtml(position)}</span>
  `;
  button.addEventListener("click", () => openPicker(slot));
  button.addEventListener("dragstart", (event) => {
    state.draggedSlot = slot;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(slot));
  });
  button.addEventListener("dragend", () => {
    state.draggedSlot = null;
    els.slots.forEach((node) => node.classList.remove("is-drop-target"));
  });
  slotEl.append(button);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countChanges() {
  const base = new Map(state.seasonSquad.map((entry) => [entry.player.id, entry.slot]));
  const current = new Map(state.matchweekSquad.map((entry) => [entry.player.id, entry.slot]));
  const playerIds = new Set([...base.keys(), ...current.keys()]);
  let changes = 0;
  playerIds.forEach((playerId) => {
    if (!base.has(playerId) || !current.has(playerId) || base.get(playerId) !== current.get(playerId)) changes += 1;
  });
  return Math.ceil(changes / 2) || (changes > 0 ? 1 : 0);
}

function render() {
  const squad = getActiveSquad();
  const bySlot = new Map(squad.map((entry) => [entry.slot, entry]));
  els.slots.forEach((slotEl) => renderSlot(slotEl, bySlot.get(Number(slotEl.dataset.slot))));

  const selected = squad.length;
  const clubs = new Set(squad.map((entry) => entry.teamId)).size;
  const changes = countChanges();

  els.selectedCount.textContent = selected;
  els.summarySelected.textContent = `${selected} / 5`;
  els.clubCount.textContent = clubs;
  els.changeCount.textContent = state.mode === "season" ? "—" : String(changes);

  const isSeason = state.mode === "season";
  els.builderModeLabel.textContent = isSeason ? "DEFAULT SEASON SQUAD" : "MATCHWEEK 1 VERSION";
  els.builderTitle.textContent = isSeason ? "Your SX5" : "Man City vs Arsenal";
  els.summaryTitle.textContent = isSeason ? "Season squad" : "Matchweek 1";
  els.saveBtn.textContent = isSeason ? "Save season squad" : "Save Matchweek 1 changes";
  els.generateBtn.textContent = isSeason ? "Generate another 5" : "Generate Matchweek 1 five";
  els.restoreBtn.hidden = isSeason;
  els.saveNote.textContent = isSeason
    ? "Your five default players are stored in this browser."
    : "These edits are stored separately and do not overwrite your season squad.";

  els.seasonModeBtn.classList.toggle("active", isSeason);
  els.matchweekModeBtn.classList.toggle("active", !isSeason);
  els.seasonModeBtn.setAttribute("aria-selected", String(isSeason));
  els.matchweekModeBtn.setAttribute("aria-selected", String(!isSeason));
}

async function openPicker(slot) {
  state.activeSlot = slot;
  const existing = getActiveSquad().find((entry) => entry.slot === slot);
  if (existing) state.currentPickerTeam = existing.teamSlug;
  els.teamSelect.value = state.currentPickerTeam;
  els.playerSearch.value = "";
  els.dialogHeading.textContent = existing ? "Replace player" : "Add player";
  els.removePlayerBtn.hidden = !existing;
  els.dialog.showModal();
  await renderPicker();
}

async function renderPicker() {
  const slug = els.teamSelect.value;
  state.currentPickerTeam = slug;
  els.pickerMeta.textContent = "Loading players…";
  els.playerList.innerHTML = "";

  try {
    const data = await loadTeam(slug);
    const query = els.playerSearch.value.trim().toLowerCase();
    const activeSquad = getActiveSquad();
    const selectedIds = new Set(activeSquad.map((entry) => entry.player.id));
    const currentAtSlot = activeSquad.find((entry) => entry.slot === state.activeSlot)?.player.id;

    const players = data.players.filter((player) => {
      const haystack = `${player.name} ${player.shortName || ""} ${(player.detailedPositions || []).join(" ")}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    els.pickerMeta.textContent = `${data.team.name} · ${players.length} player${players.length === 1 ? "" : "s"}`;
    els.playerList.innerHTML = players.map((player) => {
      const alreadySelected = selectedIds.has(player.id) && player.id !== currentAtSlot;
      const pos = player.detailedPositions?.join(" / ") || player.positionGroup || "Player";
      return `
        <button class="player-option" type="button" data-player-id="${player.id}" ${alreadySelected ? "disabled" : ""}
          style="--club-primary:${escapeHtml(data.team.primaryColor || "#25382b")}; --club-secondary:${escapeHtml(data.team.secondaryColor || "#131b16")}; --club-text:${escapeHtml(data.team.textColor || "#fff")}">
          <span class="player-option-avatar">${initials(player.shortName || player.name)}</span>
          <span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(pos)}${player.shirtNumber ? ` · #${player.shirtNumber}` : ""}</small></span>
          <span class="option-tag">${alreadySelected ? "SELECTED" : data.team.code}</span>
        </button>
      `;
    }).join("");

    els.playerList.querySelectorAll(".player-option:not(:disabled)").forEach((button) => {
      button.addEventListener("click", () => selectPlayer(data, Number(button.dataset.playerId)));
    });
  } catch (error) {
    els.pickerMeta.textContent = "Could not load this squad.";
    els.playerList.innerHTML = `<p style="color:#ff8b91;padding:14px">${escapeHtml(error.message)}</p>`;
  }
}

function selectPlayer(teamData, playerId) {
  const player = teamData.players.find((candidate) => candidate.id === playerId);
  if (!player || state.activeSlot === null) return;

  const squad = getActiveSquad().filter((entry) => entry.slot !== state.activeSlot && entry.player.id !== playerId);
  if (squad.length >= 5) {
    showToast("SX5 squads contain exactly five players. Replace one instead.");
    return;
  }
  squad.push(entryFor(teamData.team, player, state.activeSlot));
  setActiveSquad(squad);
  persistActiveDraft();
  els.dialog.close();
  render();
}

function removeActivePlayer() {
  if (state.activeSlot === null) return;
  setActiveSquad(getActiveSquad().filter((entry) => entry.slot !== state.activeSlot));
  persistActiveDraft();
  els.dialog.close();
  render();
}

function persistActiveDraft() {
  const squad = getActiveSquad();
  saveJson(state.mode === "season" ? STORAGE_KEYS.season : STORAGE_KEYS.matchweek1, squad);
}

function switchMode(mode) {
  if (mode === state.mode) return;
  if (mode === "matchweek" && state.matchweekSquad.length === 0) {
    state.matchweekSquad = cloneSquad(state.seasonSquad);
    saveJson(STORAGE_KEYS.matchweek1, state.matchweekSquad);
  }
  state.mode = mode;
  render();
}

async function generateRandomFive() {
  if (!state.league) return;
  els.generateBtn.disabled = true;
  els.generateBtn.textContent = "Generating…";
  try {
    const shuffledTeams = [...state.league.teams].sort(() => Math.random() - 0.5);
    const pool = [];
    for (const team of shuffledTeams.slice(0, 7)) {
      const data = await loadTeam(team.slug);
      const sample = [...data.players].sort(() => Math.random() - 0.5).slice(0, 2);
      sample.forEach((player) => pool.push({ team: data.team, player }));
      if (pool.length >= 10) break;
    }

    const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
    const slots = [...Array(10).keys()].sort(() => Math.random() - 0.5).slice(0, 5);
    const next = chosen.map(({ team, player }, index) => entryFor(team, player, slots[index]));
    setActiveSquad(next);
    persistActiveDraft();
    render();
    showToast(state.mode === "season" ? "New season five generated." : "New Matchweek 1 five generated.");
  } finally {
    els.generateBtn.disabled = false;
    render();
  }
}

function saveCurrent() {
  const squad = getActiveSquad();
  if (squad.length !== 5) {
    showToast(`Select ${5 - squad.length} more player${5 - squad.length === 1 ? "" : "s"} first.`);
    return;
  }
  persistActiveDraft();
  if (state.mode === "season") {
    if (!localStorage.getItem(STORAGE_KEYS.matchweek1)) {
      state.matchweekSquad = cloneSquad(state.seasonSquad);
      saveJson(STORAGE_KEYS.matchweek1, state.matchweekSquad);
    }
    showToast("Default season squad saved.");
  } else {
    showToast("Matchweek 1 changes saved separately.");
  }
}

function restoreMatchweek() {
  state.matchweekSquad = cloneSquad(state.seasonSquad);
  saveJson(STORAGE_KEYS.matchweek1, state.matchweekSquad);
  render();
  showToast("Matchweek 1 reset to your season squad.");
}

async function resetDemo() {
  localStorage.removeItem(STORAGE_KEYS.season);
  localStorage.removeItem(STORAGE_KEYS.matchweek1);
  state.seasonSquad = await getDemoSquad();
  state.matchweekSquad = cloneSquad(state.seasonSquad);
  saveJson(STORAGE_KEYS.season, state.seasonSquad);
  saveJson(STORAGE_KEYS.matchweek1, state.matchweekSquad);
  state.mode = "season";
  render();
  showToast("Demo squad restored.");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function wireDragTargets() {
  els.slots.forEach((slotEl) => {
    slotEl.addEventListener("dragover", (event) => {
      if (state.draggedSlot === null) return;
      event.preventDefault();
      slotEl.classList.add("is-drop-target");
      event.dataTransfer.dropEffect = "move";
    });
    slotEl.addEventListener("dragleave", () => slotEl.classList.remove("is-drop-target"));
    slotEl.addEventListener("drop", (event) => {
      event.preventDefault();
      slotEl.classList.remove("is-drop-target");
      const fromSlot = Number(event.dataTransfer.getData("text/plain"));
      const toSlot = Number(slotEl.dataset.slot);
      if (!Number.isInteger(fromSlot) || fromSlot === toSlot) return;
      const squad = getActiveSquad();
      const from = squad.find((entry) => entry.slot === fromSlot);
      if (!from) return;
      const to = squad.find((entry) => entry.slot === toSlot);
      if (to) {
        from.slot = toSlot;
        to.slot = fromSlot;
      } else {
        from.slot = toSlot;
      }
      setActiveSquad([...squad]);
      persistActiveDraft();
      render();
    });
  });
}

function wireEvents() {
  els.seasonModeBtn.addEventListener("click", () => switchMode("season"));
  els.matchweekModeBtn.addEventListener("click", () => switchMode("matchweek"));
  els.saveBtn.addEventListener("click", saveCurrent);
  els.generateBtn.addEventListener("click", generateRandomFive);
  els.restoreBtn.addEventListener("click", restoreMatchweek);
  els.resetAllBtn.addEventListener("click", resetDemo);
  els.teamSelect.addEventListener("change", renderPicker);
  els.playerSearch.addEventListener("input", renderPicker);
  els.removePlayerBtn.addEventListener("click", removeActivePlayer);
  els.closeDialogBtn.addEventListener("click", () => els.dialog.close());
  els.cancelDialogBtn.addEventListener("click", () => els.dialog.close());
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) els.dialog.close();
  });
  wireDragTargets();
}

async function init() {
  try {
    await loadLeague();
    wireEvents();

    const savedSeason = normalizeSquad(readJson(STORAGE_KEYS.season));
    state.seasonSquad = savedSeason.length ? savedSeason : await getDemoSquad();
    if (!savedSeason.length) saveJson(STORAGE_KEYS.season, state.seasonSquad);

    const savedMatchweek = normalizeSquad(readJson(STORAGE_KEYS.matchweek1));
    state.matchweekSquad = savedMatchweek.length ? savedMatchweek : cloneSquad(state.seasonSquad);
    if (!savedMatchweek.length) saveJson(STORAGE_KEYS.matchweek1, state.matchweekSquad);

    render();
  } catch (error) {
    console.error(error);
    document.querySelector(".page").innerHTML = `
      <section style="padding:40px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:#101713">
        <h1 style="font-size:32px">SX5 could not load its catalogue</h1>
        <p style="color:#9aa69e;line-height:1.6">${escapeHtml(error.message)}</p>
        <p style="color:#9aa69e">Run this through Cloudflare Pages or a local web server rather than opening index.html directly with file://.</p>
      </section>`;
  }
}

init();
