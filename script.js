const STORAGE_KEY = "riftbound-collection-v1";
const AUTH_KEY = "riftbound-auth-v1";
const SITE = window.RIFT_SITE || {};
const RARITY_RANK = { common: 1, uncommon: 2, rare: 3, epic: 4, showcase: 5 };
const TYPES = ["Unit", "Spell", "Gear", "Legend", "Rune", "Battlefield"];
const DOMAINS = ["Fury", "Calm", "Mind", "Body", "Chaos", "Order", "Colorless"];
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Showcase"];

const els = {
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  grid: document.getElementById("cardGrid"),
  empty: document.getElementById("empty"),
  status: document.getElementById("status"),
  modal: document.getElementById("cardModal"),
  modalBody: document.getElementById("modalBody"),
  catalog: document.getElementById("statCatalog"),
  owned: document.getElementById("statOwned"),
  copies: document.getElementById("statCopies"),
  shown: document.getElementById("statShown"),
  exportBtn: document.getElementById("exportCollection"),
  importCsv: document.getElementById("importCsv"),
  loginGate: document.getElementById("loginGate"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  password: document.getElementById("password"),
  remember: document.getElementById("rememberDevice"),
  app: document.getElementById("app"),
  vaultToggle: document.getElementById("vaultToggle"),
  loginCancel: document.getElementById("loginCancel"),
};

const state = {
  cards: [],
  sets: [],
  publicCollection: {},
  collection: {},
  booted: false,
  filters: {
    set: "all",
    type: "all",
    domain: "all",
    rarity: "all",
    view: "all",
    query: "",
    sort: "number",
  },
};

async function sha256Hex(text) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function isAuthed() {
  const saved = readAuth();
  return Boolean(saved && saved.hash === SITE.passwordHash && saved.expires > Date.now());
}

function persistAuth(remember) {
  const days = remember ? 30 : 0.5;
  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      hash: SITE.passwordHash,
      expires: Date.now() + days * 24 * 60 * 60 * 1000,
    })
  );
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

function openLogin() {
  els.loginError.hidden = true;
  els.password.value = "";
  els.loginGate.showModal();
  els.password.focus();
}

function applyEditMode() {
  const editing = isAuthed();
  document.body.classList.toggle("can-edit", editing);
  els.vaultToggle.textContent = editing ? "Lock editing" : "Unlock editing";

  if (editing) {
    const local = loadCollection();
    state.collection = Object.keys(local).length ? local : { ...state.publicCollection };
    if (!Object.keys(local).length) saveCollection();
  } else {
    state.collection = { ...state.publicCollection };
  }

  if (state.booted) renderCards();
  if (els.modal.open) els.modal.close();
}

function lockEditing() {
  clearAuth();
  applyEditMode();
}

async function verifyPassword(password) {
  const hash = await sha256Hex(`${SITE.salt}${password}`);
  return hash === SITE.passwordHash;
}

function loadCollection() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCollection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.collection));
}

function qty(id) {
  return Number(state.collection[id] || 0);
}

function setQty(id, next) {
  const value = Math.max(0, Number(next) || 0);
  if (value === 0) delete state.collection[id];
  else state.collection[id] = value;
  saveCollection();
}

function imageUrl(url, width) {
  if (!url) return "";
  const base = url.split("?")[0];
  return `${base}?accountingTag=RB&w=${width}&fit=max&auto=format`;
}

function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, i) => {
      row[header] = (values[i] || "").trim();
    });
    return row;
  });
}

function matchCsvRow(row) {
  const name = (row.name || "").toLowerCase();
  const set = (row.set || "").toUpperCase();
  const candidates = state.cards.filter(
    (card) => card.name.toLowerCase() === name && card.set === set
  );
  if (!candidates.length) return null;

  const alt = String(row.altArt || "").toLowerCase() === "true";
  const overnumbered = String(row.overnumbered || "").toLowerCase() === "true";
  const scored = candidates.map((card) => {
    const code = (card.code || "").toLowerCase();
    const looksAlt = /[a-z]/.test((card.id.split("-")[1] || "").replace(/\d+/g, "")) || /a\b/.test(code);
    const looksOver = code.includes("*") || card.number > 300;
    let score = 0;
    if (alt === looksAlt) score += 2;
    if (overnumbered === looksOver) score += 2;
    return { card, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].card;
}

function applyCsvRows(rows, { onlyIfEmpty = false, replace = false, target = state.collection } = {}) {
  if (onlyIfEmpty && Object.keys(target).length) return 0;
  let applied = 0;
  for (const row of rows) {
    const card = matchCsvRow(row);
    const amount = Number(row.quantity || 0);
    if (!card || amount < 0) continue;
    target[card.id] = replace ? amount : (target[card.id] || 0) + amount;
    if (target[card.id] === 0) delete target[card.id];
    applied += 1;
  }
  if (applied && target === state.collection) saveCollection();
  return applied;
}

function chipButton(label, active, attrs = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `chip${active ? " active" : ""}`;
  btn.textContent = label;
  Object.entries(attrs).forEach(([key, value]) => btn.setAttribute(key, value));
  return btn;
}

function renderFilterGroup(containerId, values, current, attrName, allLabel = "All") {
  const group = document.getElementById(containerId);
  group.replaceChildren();
  group.append(chipButton(allLabel, current === "all", { [`data-${attrName}`]: "all" }));
  values.forEach((value) => {
    const id = typeof value === "string" ? value : value.id;
    const label = typeof value === "string" ? value : value.name;
    group.append(
      chipButton(label, current === id, {
        [`data-${attrName}`]: id,
        ...(attrName === "domain" ? { "data-domain": id } : {}),
      })
    );
  });
}

function renderFilters() {
  renderFilterGroup("setFilters", state.sets, state.filters.set, "set", "All sets");
  renderFilterGroup("typeFilters", TYPES, state.filters.type, "type", "All types");
  renderFilterGroup("domainFilters", DOMAINS, state.filters.domain, "domain", "All domains");
  renderFilterGroup("rarityFilters", RARITIES, state.filters.rarity, "rarity", "All rarities");
}

function filteredCards() {
  const q = state.filters.query.trim().toLowerCase();
  const rarityOrder = RARITY_RANK;

  const list = state.cards.filter((card) => {
    if (state.filters.set !== "all" && card.set !== state.filters.set) return false;
    if (state.filters.type !== "all" && !card.types.includes(state.filters.type)) return false;
    if (state.filters.domain !== "all" && !card.domains.includes(state.filters.domain)) return false;
    if (state.filters.rarity !== "all" && card.rarity !== state.filters.rarity) return false;

    const owned = qty(card.id) > 0;
    if (state.filters.view === "owned" && !owned) return false;
    if (state.filters.view === "missing" && owned) return false;

    if (!q) return true;
    const haystack = [
      card.name,
      card.code,
      card.set,
      card.setName,
      card.rarity,
      ...(card.types || []),
      ...(card.domains || []),
      ...(card.tags || []),
      card.text,
      card.effect,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  const sort = state.filters.sort;
  list.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "set") return a.set.localeCompare(b.set) || a.number - b.number;
    if (sort === "energy") return (a.energy ?? 99) - (b.energy ?? 99) || a.name.localeCompare(b.name);
    if (sort === "might") return (b.might ?? -1) - (a.might ?? -1) || a.name.localeCompare(b.name);
    if (sort === "rarity") {
      return (rarityOrder[b.rarityId] || 0) - (rarityOrder[a.rarityId] || 0) || a.number - b.number;
    }
    return a.set.localeCompare(b.set) || a.number - b.number || a.name.localeCompare(b.name);
  });
  return list;
}

function updateStats(shownCount) {
  const ownedIds = Object.keys(state.collection).filter((id) => qty(id) > 0);
  const copies = ownedIds.reduce((sum, id) => sum + qty(id), 0);
  els.catalog.textContent = String(state.cards.length);
  els.owned.textContent = String(ownedIds.length);
  els.copies.textContent = String(copies);
  els.shown.textContent = String(shownCount);
}

function cardTile(card) {
  const ownedCount = qty(card.id);
  const button = document.createElement("article");
  button.className = `card-tile${ownedCount ? " owned" : ""}`;
  button.dataset.id = card.id;
  const canEdit = isAuthed();
  const showQty = canEdit || ownedCount > 0;
  button.innerHTML = `
    <div class="art-wrap ${card.orientation === "landscape" ? "landscape" : ""}">
      <img src="${imageUrl(card.image, 360)}" alt="${card.name}" loading="lazy" width="360" height="500">
      ${showQty ? `<div class="qty${canEdit ? "" : " is-readonly"}">
        ${canEdit ? `<button type="button" data-delta="-1" aria-label="Remove one ${card.name}">−</button>` : ""}
        <span>${ownedCount}</span>
        ${canEdit ? `<button type="button" data-delta="1" aria-label="Add one ${card.name}">+</button>` : ""}
      </div>` : ""}
    </div>
    <div class="card-meta">
      <strong>${card.name}</strong>
      <small>${card.code} · ${card.types.join(", ")}</small>
    </div>
  `;
  return button;
}

function renderCards() {
  const cards = filteredCards();
  updateStats(cards.length);
  els.empty.hidden = cards.length > 0;
  els.grid.replaceChildren();
  const fragment = document.createDocumentFragment();
  cards.forEach((card, index) => {
    const tile = cardTile(card);
    tile.style.setProperty("--i", String(Math.min(index, 24)));
    fragment.append(tile);
  });
  els.grid.append(fragment);
}

function openModal(card) {
  const ownedCount = qty(card.id);
  const facts = [
    card.code,
    card.setName,
    card.rarity,
    ...card.types,
    ...card.superTypes,
    card.energy != null ? `Energy ${card.energy}` : null,
    card.might != null ? `Might ${card.might}` : null,
    card.power != null ? `Power ${card.power}` : null,
    card.mightBonus ? `Bonus ${card.mightBonus}` : null,
    ...card.tags,
  ].filter(Boolean);

  els.modalBody.innerHTML = `
    <img src="${imageUrl(card.image, 744)}" alt="${card.name}">
    <div class="modal-copy">
      <h2>${card.name}</h2>
      <div class="facts">${facts.map((fact) => `<span>${fact}</span>`).join("")}</div>
      <div class="facts">${card.domains.map((domain) => `<span class="domain-pip">${domain}</span>`).join("")}</div>
      <p class="rules">${card.text || card.effect || "No rules text."}</p>
      ${card.illustrator?.length ? `<p class="rules">Art: ${card.illustrator.join(", ")}</p>` : ""}
      ${isAuthed() ? `
      <div class="modal-qty qty" data-id="${card.id}">
        <button type="button" data-delta="-1">−</button>
        <span>${ownedCount}</span>
        <button type="button" data-delta="1">+</button>
        <small>copies owned</small>
      </div>` : `<p class="rules">${ownedCount} ${ownedCount === 1 ? "copy" : "copies"} in Ras's collection</p>`}
    </div>
  `;
  els.modal.showModal();
}

function bindChipGroup(id, key) {
  document.getElementById(id).addEventListener("click", (event) => {
    const btn = event.target.closest(`[data-${key}]`);
    if (!btn) return;
    state.filters[key] = btn.getAttribute(`data-${key}`);
    renderFilters();
    renderCards();
  });
}

function exportCollection() {
  const rows = [["name", "set", "quantity", "type", "color", "altArt", "overnumbered", "image"]];
  for (const card of state.cards) {
    const amount = qty(card.id);
    if (!amount) continue;
    const alt = /a\b/i.test(card.code) || (card.id.match(/-\d+[a-z]/) != null);
    const overnumbered = (card.code || "").includes("*");
    rows.push([
      card.name,
      card.set,
      amount,
      (card.types[0] || "").toUpperCase(),
      card.domains.map((d) => d.toUpperCase()).join("&"),
      String(alt),
      String(overnumbered),
      `${slugify(card.name)}-${slugify(card.set)}${alt ? "-a" : ""}${overnumbered ? "-o" : ""}.avif`,
    ]);
  }
  const json = JSON.stringify(state.collection, null, 2);
  const jsonBlob = new Blob([json], { type: "application/json" });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonLink = document.createElement("a");
  jsonLink.href = jsonUrl;
  jsonLink.download = "collection.json";
  jsonLink.click();
  URL.revokeObjectURL(jsonUrl);

  const csv = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cards.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function changeQty(id, delta) {
  if (!isAuthed()) return;
  setQty(id, qty(id) + delta);
  renderCards();
  if (els.modal.open) {
    const count = els.modalBody.querySelector(".modal-qty span");
    if (count) count.textContent = String(qty(id));
  }
}

async function boot() {
  const catalog = await fetch("data/cards.json").then((res) => {
    if (!res.ok) throw new Error("Could not load card catalog");
    return res.json();
  });
  state.cards = catalog.cards || [];
  state.sets = catalog.sets || [];
  renderFilters();

  try {
    const csvText = await fetch("riftbound/cards.csv").then((res) => (res.ok ? res.text() : ""));
    if (csvText) applyCsvRows(parseCsv(csvText), { target: state.publicCollection });
  } catch {
    // Public CSV is optional if collection.json is present.
  }

  try {
    const published = await fetch("data/collection.json").then((res) => (res.ok ? res.json() : null));
    if (published && typeof published === "object" && Object.keys(published).length) {
      state.publicCollection = { ...state.publicCollection, ...published };
    }
  } catch {
    // collection.json is optional until the first export is published.
  }

  applyEditMode();
  state.booted = true;
  els.status.hidden = true;
  renderCards();
}

bindChipGroup("setFilters", "set");
bindChipGroup("typeFilters", "type");
bindChipGroup("domainFilters", "domain");
bindChipGroup("rarityFilters", "rarity");

document.getElementById("viewFilters").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-view]");
  if (!btn) return;
  state.filters.view = btn.dataset.view;
  document.querySelectorAll("#viewFilters .chip").forEach((chip) => {
    chip.classList.toggle("active", chip === btn);
  });
  renderCards();
});

els.search.addEventListener("input", () => {
  state.filters.query = els.search.value;
  renderCards();
});

els.sort.addEventListener("change", () => {
  state.filters.sort = els.sort.value;
  renderCards();
});

els.grid.addEventListener("click", (event) => {
  const deltaBtn = event.target.closest("[data-delta]");
  const tile = event.target.closest(".card-tile");
  if (!tile) return;
  if (deltaBtn) {
    event.preventDefault();
    event.stopPropagation();
    changeQty(tile.dataset.id, Number(deltaBtn.dataset.delta));
    return;
  }
  const card = state.cards.find((item) => item.id === tile.dataset.id);
  if (card) openModal(card);
});

els.modal.addEventListener("click", (event) => {
  const deltaBtn = event.target.closest("[data-delta]");
  const wrap = event.target.closest("[data-id]");
  if (!deltaBtn || !wrap) return;
  changeQty(wrap.dataset.id, Number(deltaBtn.dataset.delta));
});

els.exportBtn.addEventListener("click", () => {
  if (!isAuthed()) return;
  exportCollection();
});

els.importCsv.addEventListener("change", async (event) => {
  if (!isAuthed()) return;
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const applied = applyCsvRows(parseCsv(text), { replace: true });
  els.status.hidden = false;
  els.status.textContent = applied ? `Imported quantities for ${applied} cards.` : "No matching cards found in that CSV.";
  renderCards();
  event.target.value = "";
});

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const ok = await verifyPassword(els.password.value);
  if (!ok) {
    els.loginError.hidden = false;
    const card = els.loginForm.closest(".login-card");
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
    return;
  }
  persistAuth(els.remember.checked);
  els.loginGate.close();
  applyEditMode();
});

els.loginCancel.addEventListener("click", () => els.loginGate.close());

els.vaultToggle.addEventListener("click", () => {
  if (isAuthed()) lockEditing();
  else openLogin();
});

boot().catch((error) => {
  els.status.hidden = false;
  els.status.textContent = `${error.message}. Refresh and try again.`;
});
