const dropzone = document.getElementById("dropzone");
const photoInput = document.getElementById("photoInput");
const thumbs = document.getElementById("thumbs");
const scanStatus = document.getElementById("scanStatus");
const offline = document.getElementById("offline");
const addSearch = document.getElementById("addSearch");
const suggestions = document.getElementById("suggestions");
const lotList = document.getElementById("lotList");
const emptyLot = document.getElementById("emptyLot");
const clearLot = document.getElementById("clearLot");
const unsurePanel = document.getElementById("unsurePanel");
const unsureList = document.getElementById("unsureList");
const SKIP_LINE = /\b(tradera|blocket|facebook|marketplace|frakt|fraktfritt|auktion|s[aä]ljare|k[oö]p nu|league of legends|playriftbound|riftbound tcg)\b/i;

const state = {
  cards: [],
  prices: {},
  photos: [],
  lot: new Map(),
  unsure: [],
  matches: [],
  active: 0,
  worker: null,
  busy: false,
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imageUrl(url, width) {
  if (!url) return "";
  const base = url.split("?")[0];
  if (!base.includes("cmsassets.rgpub.io")) return base;
  return `${base}?accountingTag=RB&w=${width}&fit=max&auto=format`;
}

function isAltPrint(card) {
  return /[ab]\/|[AB]$|[ab]\b|\*/.test(card.code || "") || /showcase|promo/i.test(card.rarity || "");
}

function priceCents(id) {
  const row = state.prices[id];
  return row && row.usdCents != null ? Number(row.usdCents) : null;
}

function formatUsd(cents) {
  if (cents == null || Number.isNaN(cents)) return "—";
  return (cents / 100).toLocaleString("da-DK", { style: "currency", currency: "USD" });
}

function pickPrinting(cards) {
  return [...cards].sort(
    (a, b) => Number(isAltPrint(a)) - Number(isAltPrint(b)) || String(a.code).localeCompare(String(b.code)),
  )[0];
}

function cardTitle(card) {
  return normalize(String(card.name || "").split(",")[0]);
}

function editDist(a, b) {
  if (!a || !b || Math.abs(a.length - b.length) > 3) return 99;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = new Array(rows * cols);
  for (let i = 0; i < rows; i += 1) dp[i * cols] = i;
  for (let j = 0; j < cols; j += 1) dp[j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i * cols + j] = Math.min(
        dp[(i - 1) * cols + j] + 1,
        dp[i * cols + j - 1] + 1,
        dp[(i - 1) * cols + j - 1] + cost,
      );
    }
  }
  return dp[a.length * cols + b.length];
}

function tokenScore(name, hay) {
  const tokens = name.split(" ").filter((token) => token.length > 2);
  if (!tokens.length) return hay.includes(name) ? 90 : 0;
  const hits = tokens.filter((token) => hay.includes(token)).length;
  let score = (hits / tokens.length) * 72;
  if (hay.includes(name)) score += 22;
  return score;
}

function matchFromOcr(text) {
  const hay = normalize(text);
  if (hay.length < 3) return [];
  const compact = hay.replace(/\s/g, "");
  const codeHits = [...String(text).toUpperCase().matchAll(/\b([A-Z]{3})[- ]?(\d{1,3}[AB]?)\b/g)];

  return state.cards
    .map((card) => {
      const name = normalize(card.name);
      const title = cardTitle(card);
      const code = (card.code || "").toUpperCase();
      let score = tokenScore(name, hay);
      if (name && hay === name) score = Math.max(score, 100);
      else if (title && hay === title && title.length >= 4) score = Math.max(score, 92);
      else if (name && hay.startsWith(name) && name.length >= 6) score = Math.max(score, 94);
      else if (title && title.length >= 6 && hay.includes(title)) score = Math.max(score, 88);
      else if (title && title.length >= 8 && editDist(hay, title) <= 2) score = Math.max(score, 84);
      codeHits.forEach((hit) => {
        const digits = String(hit[2]).replace(/[AB]$/i, "");
        const suffix = /[AB]$/i.test(hit[2]) ? String(hit[2]).slice(-1).toUpperCase() : "";
        const padded = `${hit[1]}-${String(Number(digits)).padStart(3, "0")}${suffix}`;
        const raw = `${hit[1]}-${hit[2]}`.toUpperCase();
        if (code.startsWith(padded) || code.includes(raw) || code.includes(padded)) {
          score = Math.max(score, 96);
        }
      });
      const codeNorm = normalize(card.code).replace(/\s/g, "");
      if (codeNorm.length >= 6 && compact.includes(codeNorm)) score = Math.max(score, 90);
      return { card, score };
    })
    .filter((item) => item.score >= 68)
    .sort((a, b) => b.score - a.score || Number(isAltPrint(a.card)) - Number(isAltPrint(b.card)))
    .slice(0, 6);
}

function confidentMatch(matches) {
  if (!matches.length) return null;
  const top = matches.filter((item) => item.score >= matches[0].score - 1);
  const sameTitle = top.every((item) => cardTitle(item.card) === cardTitle(top[0].card));
  if (sameTitle && matches[0].score >= 78) {
    return { card: pickPrinting(top.map((item) => item.card)), score: matches[0].score };
  }
  const gap = matches[0].score - (matches[1]?.score || 0);
  if (matches.length === 1 && matches[0].score >= 76) return matches[0];
  if (matches[0].score >= 86 && gap >= 5) return matches[0];
  return null;
}

function isNoisyLine(text) {
  const n = normalize(text);
  if (n.length < 3) return true;
  if (SKIP_LINE.test(text)) return true;
  if (/^\d+([.,]\d+)?$/.test(n)) return true;
  return false;
}

function searchCards(query) {
  const q = normalize(query);
  if (!q) return [];
  const compact = q.replace(/\s/g, "");
  return state.cards
    .map((card) => {
      const name = normalize(card.name);
      const code = normalize(card.code).replace(/\s/g, "");
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 86;
      else if (name.includes(q)) score = 70;
      else if (code.includes(compact) && compact.length >= 4) score = 92;
      return { card, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name))
    .slice(0, 8)
    .map((item) => item.card);
}

function lotCopies() {
  return [...state.lot.values()].reduce((sum, row) => sum + row.qty, 0);
}

function addToLot(card, qty = 1) {
  const current = state.lot.get(card.id);
  if (current) current.qty += qty;
  else state.lot.set(card.id, { card, qty });
  renderLot();
}

function setQty(id, next) {
  const row = state.lot.get(id);
  if (!row) return;
  if (next <= 0) state.lot.delete(id);
  else row.qty = next;
  renderLot();
}

function boxesOverlap(a, b) {
  const x = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const y = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const overlap = x * y;
  const area = Math.max((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return area ? overlap / area > 0.35 : false;
}

function expandNameBox(bbox) {
  const w = Math.max(24, bbox.x1 - bbox.x0);
  const h = Math.max(12, bbox.y1 - bbox.y0);
  return {
    x0: bbox.x0 - w * 0.2,
    y0: bbox.y0 - h * 0.4,
    x1: bbox.x1 + w * 0.2,
    y1: bbox.y0 + Math.max(h * 8, 120),
  };
}

function nms(hits) {
  const kept = [];
  hits
    .slice()
    .sort((a, b) => b.score - a.score)
    .forEach((hit) => {
      const cardBox = expandNameBox(hit.bbox);
      const clash = kept.find((other) => boxesOverlap(cardBox, expandNameBox(other.bbox)));
      if (!clash) kept.push(hit);
      else if (clash.card.id === hit.card.id) return;
    });
  return kept;
}

function catalogPhrases() {
  if (state.phraseList) return state.phraseList;
  const map = new Map();
  state.cards.forEach((card) => {
    const name = normalize(card.name);
    const title = cardTitle(card);
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(card);
    if (title && title !== name && title.length >= 4) {
      if (!map.has(title)) map.set(title, []);
      map.get(title).push(card);
    }
  });
  state.phraseList = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
  return state.phraseList;
}

function matchWindows(text) {
  const tokens = normalize(text).split(" ").filter((token) => token.length > 1 && /[a-z]/.test(token));
  if (!tokens.length) return [];
  const hits = [];
  catalogPhrases().forEach(([phrase, cards]) => {
    const parts = phrase.split(" ").filter(Boolean);
    if (!parts.length || phrase.length < 4) return;
    const n = parts.length;
    for (let i = 0; i <= tokens.length - n; i += 1) {
      const window = tokens.slice(i, i + n).join(" ");
      if (window[0] !== phrase[0]) continue;
      let score = 0;
      if (window === phrase) score = phrase.includes(" ") || phrase.length >= 8 ? 98 : 92;
      else if (n >= 2 && parts.every((part, idx) => {
        const piece = window.split(" ")[idx] || "";
        return piece === part || (part.length >= 5 && editDist(piece, part) <= 2);
      })) score = 82;
      else if (phrase.length >= 6 && !(n === 1 && phrase.length < 8)) {
        const dist = editDist(window, phrase);
        const allowed = phrase.length >= 12 ? 2 : 1;
        if (dist <= allowed) score = 86 - dist;
      }
      if (score) {
        hits.push({ card: pickPrinting(cards), score, phrase });
        return;
      }
    }
  });
  return hits.sort((a, b) => b.score - a.score || b.phrase.length - a.phrase.length).slice(0, 6);
}

function namesFromHay(hay, already) {
  const leftover = { text: ` ${hay} ` };
  const found = [];
  catalogPhrases().forEach(([phrase, cards]) => {
    if (phrase.length < 4 || !leftover.text.includes(` ${phrase} `)) return;
    leftover.text = leftover.text.split(` ${phrase} `).join(" ");
    const card = pickPrinting(cards);
    if (!card || already.has(card.id)) return;
    found.push({ card, qty: 1 });
  });
  return found;
}

async function loadTesseract() {
  if (window.Tesseract) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load the OCR library"));
    document.head.appendChild(script);
  });
}

async function getWorker() {
  await loadTesseract();
  if (state.worker) return state.worker;
  state.worker = await window.Tesseract.createWorker("eng", 1);
  return state.worker;
}

function prepImage(image) {
  const max = 2400;
  const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function recognize(canvas, psm = "7") {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
  const { data } = await worker.recognize(canvas);
  return data;
}

function projectionRuns(arr, thresh, minLen) {
  const runs = [];
  let start = -1;
  for (let i = 0; i <= arr.length; i += 1) {
    const on = i < arr.length && arr[i] >= thresh;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      if (i - start >= minLen) runs.push({ start, end: i });
      start = -1;
    }
  }
  return runs;
}

function detectCells(canvas) {
  const { width, height } = canvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const step = Math.max(2, Math.round(Math.max(width, height) / 360));
  const rowCount = Math.ceil(height / step);
  const colCount = Math.ceil(width / step);
  const rowDark = new Float32Array(rowCount);
  const colDark = new Float32Array(colCount);

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const lum = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
      if (lum < 145) {
        rowDark[Math.floor(y / step)] += 1;
        colDark[Math.floor(x / step)] += 1;
      }
    }
  }

  const rowRuns = projectionRuns(rowDark, Math.max(...rowDark) * 0.4, Math.max(4, Math.round(rowCount * 0.07)));
  const colRuns = projectionRuns(colDark, Math.max(...colDark) * 0.4, Math.max(4, Math.round(colCount * 0.07)));
  if (rowRuns.length >= 2 && colRuns.length >= 2 && rowRuns.length <= 7 && colRuns.length <= 7) {
    const cells = [];
    rowRuns.forEach((row) => {
      colRuns.forEach((col) => {
        cells.push({
          x: col.start * step,
          y: row.start * step,
          w: (col.end - col.start) * step,
          h: (row.end - row.start) * step,
        });
      });
    });
    return cells;
  }
  return [];
}

function sliceCanvas(source, x, y, w, h, scale = 2.2) {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(8, Math.min(Math.floor(w), source.width - sx));
  const sh = Math.max(8, Math.min(Math.floor(h), source.height - sy));
  const out = document.createElement("canvas");
  out.width = Math.max(8, Math.round(sw * scale));
  out.height = Math.max(8, Math.round(sh * scale));
  out.getContext("2d").drawImage(source, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

function cloneCanvas(source) {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d").drawImage(source, 0, 0);
  return copy;
}

function grayInvert(canvas) {
  const ctx = canvas.getContext("2d");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    let lum = 255 - (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    lum = Math.max(0, Math.min(255, (lum - 128) * 1.35 + 128));
    data[i] = data[i + 1] = data[i + 2] = lum;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

async function readCell(canvas, cell, index, total) {
  scanStatus.textContent = `Reading card ${index + 1} of ${total}…`;
  const padX = cell.w * 0.07;
  const padY = cell.h * 0.04;
  const x = cell.x + padX;
  const y = cell.y + padY;
  const w = cell.w - padX * 2;
  const h = cell.h - padY * 2;
  const full = sliceCanvas(canvas, x, y, w, h, 2.4);
  const plain = await recognize(full, "6");
  const inverted = await recognize(grayInvert(cloneCanvas(full)), "6");
  const text = `${plain.text || ""}\n${inverted.text || ""}`;
  let matches = matchWindows(text);
  if (!matches.length) matches = matchFromOcr(text);
  const best = matches[0] && matches[0].score >= 82 ? { card: matches[0].card, score: matches[0].score } : confidentMatch(matches);
  return {
    best,
    matches,
    text,
    bbox: { x0: x, y0: y, x1: x + w, y1: y + h },
  };
}

function hitsFromData(data, offset = { x: 0, y: 0 }) {
  const hits = [];
  const unsure = [];
  (data.lines || []).forEach((line) => {
    const text = (line.text || "").trim();
    if (isNoisyLine(text)) return;
    const matches = matchFromOcr(text);
    if (!matches.length) return;
    const bbox = {
      x0: (line.bbox?.x0 || 0) + offset.x,
      y0: (line.bbox?.y0 || 0) + offset.y,
      x1: (line.bbox?.x1 || 0) + offset.x,
      y1: (line.bbox?.y1 || 0) + offset.y,
    };
    const best = confidentMatch(matches);
    if (best) hits.push({ card: best.card, score: best.score, bbox, text });
    else unsure.push({ text, matches, bbox });
  });
  return { hits, unsure };
}

async function scanImage(image, photo) {
  const before = lotCopies();
  const canvas = prepImage(image);
  const cells = detectCells(canvas);
  const unsure = [];

  if (cells.length >= 6) {
    scanStatus.textContent = `Found a ${cells.length}-card grid. Reading names…`;
    for (let i = 0; i < cells.length; i += 1) {
      const result = await readCell(canvas, cells[i], i, cells.length);
      if (result.best) addToLot(result.best.card, 1);
      else if (result.matches.length) {
        unsure.push({
          text: (result.text || "").trim().slice(0, 80) || "unclear name",
          matches: result.matches,
          bbox: result.bbox,
        });
      }
    }
  }

  scanStatus.textContent = "Checking the whole photo for missed names…";
  const fullData = await recognize(canvas, "11");
  const already = new Set([...state.lot.keys()]);
  matchWindows(fullData.text || "").forEach((hit) => {
    if (!already.has(hit.card.id)) {
      addToLot(hit.card, 1);
      already.add(hit.card.id);
    }
  });
  namesFromHay(normalize(fullData.text || ""), already).forEach((item) => addToLot(item.card, item.qty));

  if (cells.length < 6 && lotCopies() === before) {
    const extracted = hitsFromData(fullData);
    nms(extracted.hits).forEach((hit) => addToLot(hit.card, 1));
    extracted.unsure.forEach((item) => unsure.push(item));
  }

  unsure.forEach((item) => {
    if (state.unsure.some((row) => row.text === item.text) || state.unsure.length >= 12) return;
    state.unsure.push({
      id: `${photo.id}-${state.unsure.length}-${item.text}`,
      photoId: photo.id,
      text: item.text,
      matches: item.matches,
    });
  });

  photo.found = lotCopies() - before;
  photo.status = photo.found ? `${photo.found} copies` : "no clear names";
}

function renderThumbs() {
  thumbs.replaceChildren();
  state.photos.forEach((photo) => {
    const fig = document.createElement("figure");
    fig.className = "lot-thumb";
    fig.innerHTML = `<img src="${photo.url}" alt=""><figcaption>${escapeHtml(photo.status)}</figcaption>`;
    thumbs.append(fig);
  });
}

function renderUnsure() {
  unsurePanel.hidden = state.unsure.length === 0;
  unsureList.replaceChildren();
  state.unsure.forEach((item) => {
    const wrap = document.createElement("div");
    wrap.className = "unsure-item";
    wrap.innerHTML = `<p>Read “${escapeHtml(item.text)}”</p>`;
    const picks = document.createElement("div");
    picks.className = "unsure-picks";
    item.matches.slice(0, 4).forEach(({ card }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${card.name} · ${card.code}`;
      btn.addEventListener("click", () => {
        addToLot(card, 1);
        state.unsure = state.unsure.filter((row) => row.id !== item.id);
        renderUnsure();
      });
      picks.append(btn);
    });
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "skip";
    skip.textContent = "Skip";
    skip.addEventListener("click", () => {
      state.unsure = state.unsure.filter((row) => row.id !== item.id);
      renderUnsure();
    });
    picks.append(skip);
    wrap.append(picks);
    unsureList.append(wrap);
  });
}

function renderSuggestions(cards) {
  state.matches = cards;
  state.active = 0;
  suggestions.replaceChildren();
  cards.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `suggestion${index === 0 ? " active" : ""}`;
    btn.innerHTML = `<strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.code)} · ${escapeHtml(card.rarity || "")} · ${formatUsd(priceCents(card.id))}</small>`;
    btn.addEventListener("click", () => {
      addToLot(card, 1);
      addSearch.value = "";
      renderSuggestions([]);
    });
    suggestions.append(btn);
  });
}

function renderLot() {
  const rows = [...state.lot.values()].sort((a, b) => {
    const aPrice = priceCents(a.card.id);
    const bPrice = priceCents(b.card.id);
    if (aPrice == null && bPrice == null) return a.card.name.localeCompare(b.card.name);
    if (aPrice == null) return 1;
    if (bPrice == null) return -1;
    return bPrice * b.qty - aPrice * a.qty;
  });

  let copies = 0;
  let total = 0;
  let unpriced = 0;
  rows.forEach((row) => {
    copies += row.qty;
    const cents = priceCents(row.card.id);
    if (cents == null) unpriced += row.qty;
    else total += cents * row.qty;
  });

  document.getElementById("statPhotos").textContent = String(state.photos.length);
  document.getElementById("statCards").textContent = String(rows.length);
  document.getElementById("statCopies").textContent = String(copies);
  document.getElementById("statValue").textContent = formatUsd(total);
  document.getElementById("statValue").title = unpriced
    ? `${unpriced} copies have no TCGplayer listing`
    : "TCGplayer listing × copies found";

  emptyLot.hidden = rows.length > 0;
  clearLot.disabled = rows.length === 0 && state.photos.length === 0;

  lotList.replaceChildren();
  rows.forEach((row) => {
    const item = document.createElement("article");
    item.className = "lot-row";
    const line = priceCents(row.card.id);
    item.innerHTML = `
      <img src="${imageUrl(row.card.image, 180)}" alt="${escapeHtml(row.card.name)}">
      <div>
        <strong>${escapeHtml(row.card.name)}</strong>
        <small>${escapeHtml(row.card.code)} · ${escapeHtml(row.card.rarity || "")} · ${formatUsd(priceCents(row.card.id))}</small>
      </div>
      <div class="qty">
        <button type="button" data-id="${row.card.id}" data-delta="-1" aria-label="Remove one">−</button>
        <span>${row.qty}</span>
        <button type="button" data-id="${row.card.id}" data-delta="1" aria-label="Add one">+</button>
        <button type="button" class="remove" data-id="${row.card.id}" data-delta="delete" aria-label="Remove card">×</button>
      </div>
      <div class="line-value">${formatUsd(line == null ? null : line * row.qty)}</div>
    `;
    lotList.append(item);
  });
}

async function addFiles(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith("image/"));
  if (!files.length) {
    scanStatus.textContent = "Those files were not images.";
    return;
  }
  if (state.busy) {
    scanStatus.textContent = "Still reading the previous photos…";
    return;
  }
  state.busy = true;
  dropzone.classList.remove("is-over");
  try {
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      const photo = { id: `${Date.now()}-${i}`, url, status: "reading…", found: 0 };
      state.photos.push(photo);
      renderThumbs();
      renderLot();
      scanStatus.textContent = `Reading photo ${i + 1} of ${files.length}… first pass can take a bit.`;
      const image = new Image();
      image.src = url;
      try {
        await image.decode();
        if (image.naturalWidth < 1200) {
          scanStatus.textContent = `Reading photo ${i + 1} of ${files.length}… this file is small, so some names may be missed. A larger original photo works better.`;
        }
        await scanImage(image, photo);
      } catch (error) {
        photo.status = "could not read";
        scanStatus.textContent = error.message || "Could not read that photo.";
      }
      renderThumbs();
      renderUnsure();
      renderLot();
    }
    const found = [...state.lot.values()].reduce((sum, row) => sum + row.qty, 0);
    scanStatus.textContent = found
      ? `Found ${found} copies. Check the list — blurry names and duplicate photos need a pass by hand.`
      : "No card names jumped out. Try a closer shot of the names, or add cards below.";
  } finally {
    state.busy = false;
    photoInput.value = "";
  }
}

function renderSuggestionActive() {
  [...suggestions.children].forEach((node, index) => {
    node.classList.toggle("active", index === state.active);
  });
}

async function loadPrices() {
  try {
    let res = await fetch("/api/prices", { cache: "no-store" });
    if (!res.ok) res = await fetch("data/prices.json", { cache: "no-store" });
    const payload = res.ok ? await res.json() : {};
    state.prices = payload.cards && typeof payload.cards === "object" ? payload.cards : {};
  } catch {
    state.prices = {};
  }
}

async function boot() {
  try {
    const health = await fetch("/api/health", { cache: "no-store" });
    if (!health.ok) throw new Error("no editor");
  } catch {
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!local) {
      offline.hidden = false;
      photoInput.disabled = true;
      addSearch.disabled = true;
      return;
    }
  }

  const catalog = await fetch("data/cards.json").then((res) => res.json());
  state.cards = catalog.cards || [];
  await loadPrices();
  renderLot();
}

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("is-over");
});

dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-over"));

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  addFiles(event.dataTransfer.files);
});

photoInput.addEventListener("change", () => {
  if (photoInput.files?.length) addFiles(photoInput.files);
});

lotList.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-id]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.delta === "delete") setQty(id, 0);
  else setQty(id, (state.lot.get(id)?.qty || 0) + Number(btn.dataset.delta));
});

addSearch.addEventListener("input", () => {
  renderSuggestions(searchCards(addSearch.value));
});

addSearch.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.active = Math.min(state.active + 1, Math.max(state.matches.length - 1, 0));
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.active = Math.max(state.active - 1, 0);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const card = state.matches[state.active];
    if (card) {
      addToLot(card, 1);
      addSearch.value = "";
      renderSuggestions([]);
      return;
    }
  } else {
    return;
  }
  renderSuggestionActive();
});

clearLot.addEventListener("click", () => {
  state.lot.clear();
  state.unsure = [];
  state.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.photos = [];
  renderThumbs();
  renderUnsure();
  renderLot();
  scanStatus.textContent = "Lot cleared.";
});

boot().catch((error) => {
  offline.hidden = false;
  offline.textContent = error.message;
});
