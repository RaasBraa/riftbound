const addSearch = document.getElementById("addSearch");
const suggestions = document.getElementById("suggestions");
const lastAdded = document.getElementById("lastAdded");
const sessionStats = document.getElementById("sessionStats");
const sessionLog = document.getElementById("sessionLog");
const undoBtn = document.getElementById("undo");
const offline = document.getElementById("offline");
const camera = document.getElementById("camera");
const cameraStage = document.getElementById("cameraStage");
const cameraPick = document.getElementById("cameraPick");
const cameraSelect = document.getElementById("cameraSelect");
const frame = document.getElementById("frame");
const startCamera = document.getElementById("startCamera");
const stopCamera = document.getElementById("stopCamera");
const scanCard = document.getElementById("scanCard");
const capturePhoto = document.getElementById("capturePhoto");
const scanStatus = document.getElementById("scanStatus");
const scanMatches = document.getElementById("scanMatches");
const heardCard = document.getElementById("heardCard");
const heardArt = document.getElementById("heardArt");
const heardImg = document.getElementById("heardImg");
const heardName = document.getElementById("heardName");
const heardCode = document.getElementById("heardCode");
const heardQty = document.getElementById("heardQty");
const plusOne = document.getElementById("plusOne");
const heardHeard = document.getElementById("heardHeard");
const startVoice = document.getElementById("startVoice");
const stopVoice = document.getElementById("stopVoice");
const voiceStatus = document.getElementById("voiceStatus");
const voicePicks = document.getElementById("voicePicks");
const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const state = {
  cards: [],
  collection: {},
  matches: [],
  active: 0,
  history: [],
  adds: 0,
  saveTimer: null,
  stream: null,
  worker: null,
  live: false,
  scanning: false,
  lastId: null,
  awaitingClear: false,
  liveGen: 0,
  listening: false,
  recognition: null,
  voicePool: null,
  currentCard: null,
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

function qty(id) {
  return Number(state.collection[id] || 0);
}

function imageUrl(url, width) {
  if (!url) return "";
  return `${url.split("?")[0]}?accountingTag=RB&w=${width}&fit=max&auto=format`;
}

function isAltPrint(card) {
  return /a\/|\*/.test(card.code || "");
}

function playAddBurst() {
  const chip = document.createElement("span");
  chip.className = "heard-burst";
  chip.textContent = "+1";
  heardArt.append(chip);
  chip.addEventListener("animationend", () => chip.remove());
  heardCard.classList.remove("pop");
  void heardCard.offsetWidth;
  heardCard.classList.add("pop");
}

function showAddedCard(card, amount) {
  state.currentCard = card;
  plusOne.disabled = false;
  heardCard.classList.remove("is-empty");
  heardImg.src = imageUrl(card.image, 420);
  heardImg.alt = card.name;
  heardName.textContent = card.name;
  heardCode.textContent = `${card.code} · ${(card.types || []).join(", ")}`;
  heardQty.textContent = `×${amount}`;
  playAddBurst();
}

function clearVoicePicks() {
  state.voicePool = null;
  voicePicks.replaceChildren();
}

function queueSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveCollection, 180);
}

async function saveCollection() {
  const payload = {};
  for (const [id, amount] of Object.entries(state.collection)) {
    if (Number(amount) > 0) payload[id] = Number(amount);
  }
  const res = await fetch("/api/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Could not save collection.json");
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
  const compact = hay.replace(/\s/g, "");
  const codeHits = [...String(text).toUpperCase().matchAll(/\b([A-Z]{3})[- ]?(\d{1,3})\b/g)];

  return state.cards
    .map((card) => {
      const name = normalize(card.name);
      const code = (card.code || "").toUpperCase();
      let score = tokenScore(name, hay);
      codeHits.forEach((hit) => {
        const padded = `${hit[1]}-${String(Number(hit[2])).padStart(3, "0")}`;
        const raw = `${hit[1]}-${hit[2]}`;
        if (code.startsWith(padded) || code.includes(raw)) score = Math.max(score, 96);
      });
      const codeNorm = normalize(card.code).replace(/\s/g, "");
      if (codeNorm.length >= 6 && compact.includes(codeNorm)) score = Math.max(score, 90);
      return { card, score };
    })
    .filter((item) => item.score >= 68)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function confidentMatch(matches) {
  const best = matches[0];
  if (!best) return null;
  const gap = best.score - (matches[1]?.score || 0);
  if (matches.length === 1 && best.score >= 78) return best;
  if (best.score >= 88 && gap >= 6) return best;
  return null;
}

function renderSuggestions(cards) {
  state.matches = cards;
  state.active = 0;
  suggestions.replaceChildren();
  cards.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `suggestion${index === 0 ? " active" : ""}`;
    btn.innerHTML = `<strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.code)} · ${escapeHtml((card.types || []).join(", "))} · owned ${qty(card.id)}</small>`;
    btn.addEventListener("click", () => addCard(card));
    suggestions.append(btn);
  });
}

function renderSession() {
  const unique = new Set(state.history.map((item) => item.id)).size;
  sessionStats.textContent = `${state.adds} adds · ${unique} unique this session`;
  sessionLog.replaceChildren();
  state.history.slice(-12).reverse().forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.name} → ${item.qty}`;
    sessionLog.append(li);
  });
  undoBtn.disabled = state.history.length === 0;
}

function addCard(card, { keepFocus = false } = {}) {
  const next = qty(card.id) + 1;
  state.collection[card.id] = next;
  state.history.push({ id: card.id, name: card.name, qty: next });
  state.adds += 1;
  lastAdded.textContent = `Added ${card.name} (${card.code}). Now ${next}.`;
  showAddedCard(card, next);
  clearVoicePicks();
  if (!state.live && !state.listening && !keepFocus) {
    addSearch.value = "";
    addSearch.focus();
    renderSuggestions([]);
  }
  renderSession();
  queueSave();
}

function undoLast() {
  const last = state.history.pop();
  if (!last) return;
  const current = qty(last.id);
  if (current <= 1) delete state.collection[last.id];
  else state.collection[last.id] = current - 1;
  state.adds = Math.max(0, state.adds - 1);
  lastAdded.textContent = `Undid ${last.name}.`;
  state.awaitingClear = false;
  state.lastId = null;
  cameraStage.classList.remove("got-card");
  const remaining = qty(last.id);
  const keep = remaining > 0 ? state.cards.find((item) => item.id === last.id) : null;
  const prev = state.history[state.history.length - 1];
  if (keep) {
    state.currentCard = keep;
    plusOne.disabled = false;
    heardCard.classList.remove("is-empty");
    heardName.textContent = keep.name;
    heardQty.textContent = `×${remaining}`;
    heardImg.src = imageUrl(keep.image, 420);
    heardCode.textContent = `${keep.code} · last add removed`;
  } else if (prev) {
    const card = state.cards.find((item) => item.id === prev.id);
    if (card) {
      state.currentCard = card;
      plusOne.disabled = false;
      heardCard.classList.remove("is-empty");
      heardName.textContent = `Undid ${last.name}`;
      heardQty.textContent = `×${qty(prev.id)}`;
      heardImg.src = imageUrl(card.image, 420);
      heardCode.textContent = `${card.code} · last add removed`;
    }
  } else {
    state.currentCard = null;
    plusOne.disabled = true;
    heardCard.classList.add("is-empty");
    heardName.textContent = `Undid ${last.name}`;
    heardCode.textContent = "Waiting for a card";
    heardQty.textContent = "";
    heardImg.removeAttribute("src");
  }
  renderSession();
  queueSave();
}

function nameBand(source) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  const band = document.createElement("canvas");
  band.width = width;
  band.height = Math.max(80, Math.floor(height * 0.32));
  band.getContext("2d").drawImage(source, 0, 0, width, band.height, 0, 0, width, band.height);
  return band;
}

function grabFrame() {
  const ctx = frame.getContext("2d");
  frame.width = camera.videoWidth;
  frame.height = camera.videoHeight;
  ctx.drawImage(camera, 0, 0, frame.width, frame.height);
  return frame;
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

async function readImage(source, { quick = false } = {}) {
  await loadTesseract();
  if (!state.worker) state.worker = await window.Tesseract.createWorker("eng");
  const band = nameBand(source);
  const { data: top } = await state.worker.recognize(band);
  const text = top.text || "";
  if (quick || matchFromOcr(text).length) return text;
  const { data: full } = await state.worker.recognize(source);
  return `${text}\n${full.text || ""}`;
}

function showPickList(matches) {
  scanMatches.replaceChildren();
  matches.forEach(({ card, score }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion";
    btn.innerHTML = `<strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.code)} · owned ${qty(card.id)} · match ${Math.round(score)}</small>`;
    btn.addEventListener("click", () => {
      acceptScan(card);
      scanMatches.replaceChildren();
    });
    scanMatches.append(btn);
  });
}

function acceptScan(card) {
  addCard(card);
  state.lastId = card.id;
  state.awaitingClear = true;
  cameraStage.classList.add("got-card");
  scanStatus.textContent = `Added ${card.name}. Pull it away, then show the next card.`;
}

function handleMatches(matches, { auto = false } = {}) {
  if (state.awaitingClear) {
    const stillThere = matches[0] && matches[0].card.id === state.lastId && matches[0].score >= 70;
    if (stillThere) {
      scanStatus.textContent = `Got it. Pull ${matches[0].card.name} away for the next card.`;
      return;
    }
    state.awaitingClear = false;
    state.lastId = null;
    cameraStage.classList.remove("got-card");
  }

  const best = confidentMatch(matches);
  if (best) {
    scanMatches.replaceChildren();
    acceptScan(best.card);
    return;
  }

  if (!matches.length) {
    if (!auto) scanStatus.textContent = "No clear match. More light, hold still, or type the name.";
    else if (!state.awaitingClear) scanStatus.textContent = "Watching… hold one card in the box.";
    return;
  }

  scanStatus.textContent = "Not sure — pick the card, or hold still.";
  showPickList(matches);
}

async function scanLive({ auto = false } = {}) {
  if (!camera.videoWidth || state.scanning) return;
  state.scanning = true;
  scanCard.disabled = true;
  if (!auto) scanStatus.textContent = "Reading card text… first scan can take a few seconds.";
  try {
    const text = await readImage(grabFrame(), { quick: auto });
    if (!state.live && auto) return;
    handleMatches(matchFromOcr(text), { auto });
  } catch (error) {
    scanStatus.textContent = error.message;
  } finally {
    state.scanning = false;
    scanCard.disabled = !state.live;
  }
}

async function liveLoop(gen) {
  scanStatus.textContent = "Loading the reader… first pass is slow.";
  await loadTesseract();
  if (!state.worker) state.worker = await window.Tesseract.createWorker("eng");
  if (gen !== state.liveGen) return;
  scanStatus.textContent = "Watching… hold one card in the box.";
  while (state.live && gen === state.liveGen) {
    if (!state.scanning) await scanLive({ auto: true });
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((device) => device.kind === "videoinput");
  cameraSelect.replaceChildren();
  cams.forEach((device, index) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    cameraSelect.append(option);
  });
  cameraPick.hidden = cams.length < 2;
  const current = state.stream?.getVideoTracks()[0]?.getSettings()?.deviceId;
  if (current) cameraSelect.value = current;
}

async function openCamera(deviceId) {
  if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
  const video = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { width: { ideal: 1280 }, height: { ideal: 720 } };
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
  camera.srcObject = state.stream;
  await camera.play();
}

function setLiveUi(on) {
  state.live = on;
  cameraStage.hidden = !on;
  cameraStage.classList.toggle("is-live", on);
  startCamera.hidden = on;
  stopCamera.hidden = !on;
  scanCard.disabled = !on;
  if (!on) {
    cameraPick.hidden = true;
    cameraStage.classList.remove("got-card");
  }
}

async function startLive(deviceId) {
  state.liveGen += 1;
  const gen = state.liveGen;
  scanStatus.textContent = "Asking for the webcam…";
  await openCamera(deviceId);
  if (gen !== state.liveGen) return;
  await listCameras();
  setLiveUi(true);
  state.awaitingClear = false;
  state.lastId = null;
  liveLoop(gen).catch((error) => {
    scanStatus.textContent = error.message;
  });
}

function stopLive() {
  state.liveGen += 1;
  state.live = false;
  state.awaitingClear = false;
  state.lastId = null;
  if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  camera.srcObject = null;
  setLiveUi(false);
  scanStatus.textContent = "Webcam stopped.";
}

function stripVoice(text) {
  return normalize(text)
    .replace(/^(add|plus|another|one|the card|card|i have|got)\s+/g, "")
    .replace(/\s+(please|thanks|thank you)$/g, "");
}

function isUndoPhrase(text) {
  return /^(undo|take back|scratch that|never mind|wrong(?: one)?)$/.test(text);
}

function speechScore(card, q) {
  const name = normalize(card.name);
  const code = normalize(card.code).replace(/\s/g, "");
  const compact = q.replace(/\s/g, "");
  const nameTokens = name.split(" ").filter(Boolean);
  const queryTokens = q.split(" ").filter((token) => token.length > 1);
  const champion = nameTokens[0] || "";
  let score = 0;
  if (name === q) score = 100;
  else if (name.startsWith(q) && q.length >= 3) score = 92;
  else if (queryTokens.length >= 2 && queryTokens.every((token) => name.includes(token))) score = 90;
  else if (nameTokens.length >= 2 && nameTokens.every((token) => q.includes(token))) score = 94;
  else if (champion === q) score = 74;
  else if (q.includes(name) && name.length > 4) score = 80;
  if (code && compact.length >= 5 && (code.includes(compact) || compact.includes(code))) score = Math.max(score, 96);
  return score;
}

function matchFromSpeech(text, pool) {
  const q = stripVoice(text);
  if (q.length < 2) return [];
  return (pool || state.cards)
    .map((card) => ({ card, score: speechScore(card, q) }))
    .filter((item) => item.score >= 74)
    .sort((a, b) => b.score - a.score || Number(isAltPrint(a.card)) - Number(isAltPrint(b.card)) || a.card.name.localeCompare(b.card.name));
}

function preferPrints(matches) {
  if (!matches.length) return [];
  const best = matches[0].score;
  const top = matches.filter((item) => item.score >= best - 2);
  const sameName = top.every((item) => item.card.name === top[0].card.name);
  if (sameName) {
    const base = top.find((item) => !isAltPrint(item.card)) || top[0];
    return [base];
  }
  return top.slice(0, 8);
}

function showVoicePicks(matches) {
  state.voicePool = matches.map((item) => item.card);
  voicePicks.replaceChildren();
  matches.forEach(({ card }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "voice-pick";
    btn.innerHTML = `<img src="${imageUrl(card.image, 220)}" alt=""><small>${escapeHtml(card.name)}<br>${escapeHtml(card.code)}</small>`;
    btn.addEventListener("click", () => {
      addCard(card);
      voiceStatus.textContent = `Added ${card.name}. Say the next name.`;
    });
    voicePicks.append(btn);
  });
}

function handleVoiceFinal(text) {
  const spoken = stripVoice(text);
  heardHeard.textContent = `Heard: ${text.trim() || "—"}`;
  if (!spoken) return;
  if (isUndoPhrase(spoken)) {
    undoLast();
    voiceStatus.textContent = "Undid last add.";
    return;
  }

  const matches = preferPrints(matchFromSpeech(spoken, state.voicePool || state.cards));
  if (!matches.length && state.voicePool) {
    const wider = preferPrints(matchFromSpeech(spoken, state.cards));
    if (wider.length === 1) {
      addCard(wider[0].card);
      voiceStatus.textContent = `Added ${wider[0].card.name}.`;
      return;
    }
    if (wider.length > 1) {
      voiceStatus.textContent = `Which one? Heard “${text.trim()}”.`;
      showVoicePicks(wider);
      return;
    }
  }

  if (matches.length === 1) {
    addCard(matches[0].card);
    voiceStatus.textContent = `Added ${matches[0].card.name}. Say it again for another copy.`;
    return;
  }
  if (matches.length > 1) {
    voiceStatus.textContent = `Which one? Heard “${text.trim()}”.`;
    showVoicePicks(matches);
    return;
  }
  voiceStatus.textContent = `No match for “${text.trim()}”. Try the title too, like Ahri Alluring.`;
}

function setVoiceUi(on) {
  state.listening = on;
  startVoice.hidden = on;
  stopVoice.hidden = !on;
  stopVoice.classList.toggle("is-listening", on);
}

function stopVoiceListen() {
  state.listening = false;
  setVoiceUi(false);
  try {
    state.recognition?.stop();
  } catch {
    // already stopped
  }
  voiceStatus.textContent = "Listening stopped.";
}

function startVoiceListen() {
  if (!SpeechAPI) {
    voiceStatus.textContent = "Voice needs Chrome or Edge on this computer.";
    return;
  }
  const recognition = new SpeechAPI();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) handleVoiceFinal(piece);
      else interim += piece;
    }
    if (interim) heardHeard.textContent = `Heard: ${interim}`;
  };
  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      voiceStatus.textContent = "Microphone is blocked. Allow it for this site in the browser.";
      stopVoiceListen();
      return;
    }
    if (event.error !== "no-speech" && event.error !== "aborted") {
      voiceStatus.textContent = `Voice error: ${event.error}`;
    }
  };
  recognition.onend = () => {
    if (!state.listening) return;
    try {
      recognition.start();
    } catch {
      // Chrome throws if a start is already pending
    }
  };
  state.recognition = recognition;
  setVoiceUi(true);
  voiceStatus.textContent = "Listening… say a card name.";
  recognition.start();
}

async function boot() {
  try {
    const health = await fetch("/api/health", { cache: "no-store" });
    if (!health.ok) throw new Error("no editor");
  } catch {
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!local) {
      offline.hidden = false;
      addSearch.disabled = true;
      startCamera.disabled = true;
      capturePhoto.disabled = true;
      startVoice.disabled = true;
      return;
    }
  }

  const catalog = await fetch("data/cards.json").then((res) => res.json());
  state.cards = catalog.cards || [];
  try {
    const published = await fetch("data/collection.json").then((res) => (res.ok ? res.json() : {}));
    state.collection = published && typeof published === "object" ? published : {};
  } catch {
    state.collection = {};
  }
}

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
    if (card) addCard(card);
  } else {
    return;
  }
  [...suggestions.children].forEach((node, index) => {
    node.classList.toggle("active", index === state.active);
  });
});

undoBtn.addEventListener("click", undoLast);

plusOne.addEventListener("click", () => {
  if (state.currentCard) addCard(state.currentCard, { keepFocus: true });
});

startVoice.addEventListener("click", () => {
  try {
    startVoiceListen();
  } catch {
    voiceStatus.textContent = "Could not start the microphone.";
    stopVoiceListen();
  }
});

stopVoice.addEventListener("click", stopVoiceListen);

if (!SpeechAPI) {
  startVoice.disabled = true;
  voiceStatus.textContent = "Voice needs Chrome or Edge on this computer.";
}

startCamera.addEventListener("click", () => {
  startLive().catch(() => {
    scanStatus.textContent = "Could not open the webcam. Check Windows camera permissions for the browser.";
  });
});

stopCamera.addEventListener("click", stopLive);

scanCard.addEventListener("click", () => scanLive({ auto: false }));

cameraSelect.addEventListener("change", () => {
  startLive(cameraSelect.value).catch((error) => {
    scanStatus.textContent = error.message;
  });
});

capturePhoto.addEventListener("change", async () => {
  const file = capturePhoto.files?.[0];
  capturePhoto.value = "";
  if (!file) return;
  scanStatus.textContent = "Reading photo… first scan can take a few seconds.";
  const image = new Image();
  image.src = URL.createObjectURL(file);
  try {
    await image.decode();
    handleMatches(matchFromOcr(await readImage(image)));
  } catch (error) {
    scanStatus.textContent = error.message || "Could not read that photo.";
  } finally {
    URL.revokeObjectURL(image.src);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key !== " " || !state.live) return;
  if (event.target === addSearch || event.target === cameraSelect) return;
  event.preventDefault();
  scanLive({ auto: false });
});

boot().catch((error) => {
  offline.hidden = false;
  offline.textContent = error.message;
});
