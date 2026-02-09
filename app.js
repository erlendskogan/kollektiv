const state = {
  monthOffset: 0,
  events: [],
  inventory: [],
  leaderboard: [],
  proofs: [],
};

const SUPABASE_URL = window.__SUPABASE_URL__;
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORAGE_BUCKET = "proofs";

let alertTimeoutId = null;
const inventorySaveTimers = new Map();

const elements = {
  today: document.getElementById("today"),
  monthLabel: document.getElementById("month-label"),
  calendarGrid: document.getElementById("calendar-grid"),
  prevMonth: document.getElementById("prev-month"),
  nextMonth: document.getElementById("next-month"),
  eventForm: document.getElementById("event-form"),
  eventDate: document.getElementById("event-date"),
  eventTitle: document.getElementById("event-title"),
  eventNote: document.getElementById("event-note"),
  inventoryList: document.getElementById("inventory-list"),
  inventoryForm: document.getElementById("inventory-form"),
  itemName: document.getElementById("item-name"),
  itemType: document.getElementById("item-type"),
  itemMax: document.getElementById("item-max"),
  eventList: document.getElementById("event-list"),
  leaderboardList: document.getElementById("leaderboard-list"),
  proofForm: document.getElementById("proof-form"),
  proofUser: document.getElementById("proof-user"),
  proofTask: document.getElementById("proof-task"),
  proofPhoto: document.getElementById("proof-photo"),
  proofLog: document.getElementById("proof-log"),
  inventoryAlert: document.getElementById("inventory-alert"),
};

const defaultData = {
  events: [
    {
      date: new Date().toISOString().slice(0, 10),
      title: "Husmote",
      note: "Planlegg uka",
    },
  ],
  inventory: [
    { name: "Kaffe", qty: 8, type: "count", min: 0, max: 20 },
    { name: "Toalettpapir", qty: 12, type: "count", min: 0, max: 20 },
    { name: "Vaskemiddel", qty: 80, type: "percent", min: 0, max: 100 },
    { name: "Oppvaskmiddel", qty: 65, type: "percent", min: 0, max: 100 },
  ],
  leaderboard: [
    { name: "theodor_gay", score: 0 },
    { name: "oscar_gay", score: 0 },
    { name: "erlend", score: 0 },
  ],
};

function formatDate(date) {
  return date.toLocaleDateString("no-NO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function renderToday() {
  const now = new Date();
  elements.today.textContent = `I dag: ${formatDate(now)}`;
}

function normalizeInventory(items) {
  return items.map((item) => {
    const type = item.type === "percent" ? "percent" : "count";
    const min = typeof item.min === "number" ? item.min : 0;
    const max =
      typeof item.max === "number"
        ? item.max
        : type === "percent"
        ? 100
        : 20;
    const qty =
      typeof item.qty === "number"
        ? Math.max(min, Math.min(item.qty, max))
        : type === "percent"
        ? 100
        : max;
    return {
      ...item,
      type,
      min,
      max,
      qty,
    };
  });
}

function normalizeLeaderboard(items) {
  return items.map((item) => ({
    ...item,
    score: typeof item.score === "number" ? item.score : 0,
  }));
}

function getMonthDate() {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + state.monthOffset);
  return base;
}

function renderCalendar() {
  const monthDate = getMonthDate();
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startDay = new Date(year, month, 1);
  const endDay = new Date(year, month + 1, 0);
  const startOffset = (startDay.getDay() + 6) % 7; // Monday start
  const totalCells = 42;

  elements.monthLabel.textContent = monthDate.toLocaleDateString("no-NO", {
    month: "long",
    year: "numeric",
  });

  elements.calendarGrid.innerHTML = "";

  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(year, month, 1 - startOffset + i);
    const isOutside = cellDate.getMonth() !== month;
    const dateKey = cellDate.toISOString().slice(0, 10);
    const cell = document.createElement("div");
    cell.className = `day${isOutside ? " outside" : ""}`;
    cell.dataset.date = dateKey;

    const header = document.createElement("div");
    header.className = "day-header";

    const label = document.createElement("span");
    label.textContent = cellDate.getDate();

    const dayName = document.createElement("span");
    dayName.textContent = cellDate
      .toLocaleDateString("no-NO", { weekday: "short" })
      .slice(0, 2)
      .toUpperCase();

    header.append(label, dayName);
    cell.append(header);

    const events = state.events.filter((event) => event.date === dateKey);

    events.forEach((event, index) => {
      const pill = document.createElement("div");
      pill.className = `event-pill${index % 2 === 0 ? "" : " secondary"}`;
      pill.textContent = event.title;
      pill.title = event.note || event.title;
      cell.append(pill);
    });

    elements.calendarGrid.append(cell);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const highlight = Array.from(elements.calendarGrid.children).find(
    (child) => child.dataset.date === todayKey
  );
  if (highlight && state.monthOffset === 0) {
    highlight.style.border = "1px solid rgba(255, 159, 104, 0.6)";
  }

  renderEventList();
}

function renderEventList() {
  if (!elements.eventList) return;
  elements.eventList.innerHTML = "";

  if (state.events.length === 0) {
    const empty = document.createElement("div");
    empty.className = "event-row";
    empty.textContent = "Ingen planlagte ting.";
    elements.eventList.append(empty);
    return;
  }

  const sorted = [...state.events].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((event) => {
    const row = document.createElement("div");
    row.className = "event-row";

    const info = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = event.title;
    const meta = document.createElement("small");
    meta.textContent = `${event.date}${event.note ? ` - ${event.note}` : ""}`;
    info.append(title, meta);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small danger";
    remove.textContent = "Fjern";
    remove.addEventListener("click", () => removeEvent(event.id));

    row.append(info, remove);
    elements.eventList.append(row);
  });
}

function renderInventory() {
  elements.inventoryList.innerHTML = "";
  if (state.inventory.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "Ingen varer registrert.";
    empty.className = "inventory-item";
    elements.inventoryList.append(empty);
    return;
  }

  state.inventory.forEach((item) => {
    const li = document.createElement("li");
    li.className = "inventory-item";

    const meta = document.createElement("div");
    meta.className = "meta";

    const name = document.createElement("span");
    name.textContent = item.name;

    const unit = document.createElement("small");
    unit.textContent = item.type === "percent" ? "Prosent" : "Antall";

    meta.append(name, unit);

    const sliderWrap = document.createElement("div");
    sliderWrap.className = "inventory-slider";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = item.min ?? 0;
    slider.max = item.max ?? (item.type === "percent" ? 100 : 20);
    slider.value = item.qty;
    slider.addEventListener("input", () =>
      setInventoryValue(item.id, Number(slider.value), value)
    );

    const value = document.createElement("div");
    value.className = "inventory-value";
    value.textContent = formatInventoryValue(item);

    sliderWrap.append(slider);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small danger";
    remove.textContent = "Slett";
    remove.addEventListener("click", () => removeInventory(item.id));

    li.append(meta, sliderWrap, value, remove);
    elements.inventoryList.append(li);
  });
}

function renderLeaderboard() {
  elements.leaderboardList.innerHTML = "";
  const sorted = [...state.leaderboard].sort((a, b) => b.score - a.score);

  sorted.forEach((user, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-item";

    const userWrap = document.createElement("div");
    userWrap.className = "user";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = user.name.slice(0, 2).toUpperCase();

    const meta = document.createElement("div");
    const name = document.createElement("div");
    name.textContent = user.name;

    const rank = document.createElement("div");
    rank.className = "muted";
    rank.textContent = `#${index + 1} i kollektivet`;
    rank.style.color = "#b9c0cf";
    rank.style.fontSize = "12px";

    meta.append(name, rank);
    userWrap.append(avatar, meta);

    const score = document.createElement("div");
    score.className = "score";
    score.textContent = user.score;

    row.append(userWrap, score);
    elements.leaderboardList.append(row);
  });
}

function renderProofs() {
  elements.proofLog.innerHTML = "";
  if (state.proofs.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Ingen bevis lastet opp enda.";
    empty.style.color = "#b9c0cf";
    elements.proofLog.append(empty);
    return;
  }

  const sorted = [...state.proofs].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  sorted.slice(0, 6).forEach((proof) => {
    const entry = document.createElement("div");
    entry.className = "proof-log-entry";

    const title = document.createElement("div");
    title.textContent = `${proof.user_name} +1 for ${proof.task}`;

    const time = document.createElement("div");
    time.style.color = "#b9c0cf";
    time.style.fontSize = "12px";
    time.textContent = new Date(proof.created_at).toLocaleString("no-NO");

    const img = document.createElement("img");
    img.src = proof.photo_url;
    img.alt = `Bevis for ${proof.task}`;

    entry.append(title, time, img);
    elements.proofLog.append(entry);
  });
}

function formatInventoryValue(item) {
  if (item.type === "percent") {
    return `${item.qty}%`;
  }
  return `x${item.qty}`;
}

async function removeInventory(id) {
  state.inventory = state.inventory.filter((item) => item.id !== id);
  renderInventory();
  await supabase.from("inventory").delete().eq("id", id);
}

function setInventoryValue(id, value, valueEl) {
  let alertItem = null;
  state.inventory = state.inventory.map((item) => {
    if (item.id !== id) return item;
    const next = {
      ...item,
      qty: Math.max(item.min ?? 0, Math.min(value, item.max ?? value)),
    };
    if (next.type === "percent" && next.qty === 0) {
      alertItem = next;
    }
    if (valueEl) {
      valueEl.textContent = formatInventoryValue(next);
    }
    return next;
  });
  if (!valueEl) {
    renderInventory();
  }
  scheduleInventorySave(id);
  if (alertItem) {
    showInventoryAlert(`${alertItem.name} er tom (0%).`);
  }
}

async function addInventory(name, type, maxValue) {
  const max =
    type === "percent" ? 100 : Math.max(1, Math.min(Number(maxValue) || 20, 50));
  const item = {
    name: name.trim(),
    type,
    min: 0,
    max,
    qty: type === "percent" ? 100 : max,
  };
  const { data, error } = await supabase
    .from("inventory")
    .insert(item)
    .select()
    .single();
  if (error) {
    console.error("Kunne ikke legge til vare", error);
    return;
  }
  state.inventory = [data, ...state.inventory];
  renderInventory();
}

async function addEvent(date, title, note) {
  const { data, error } = await supabase
    .from("events")
    .insert({ date, title: title.trim(), note: note.trim() })
    .select()
    .single();
  if (error) {
    console.error("Kunne ikke legge til event", error);
    return;
  }
  state.events = [data, ...state.events];
  renderCalendar();
}

async function removeEvent(id) {
  state.events = state.events.filter((event) => event.id !== id);
  renderCalendar();
  await supabase.from("events").delete().eq("id", id);
}

async function addProof({ user, task, photoUrl }) {
  const { data, error } = await supabase
    .from("proofs")
    .insert({ user_name: user, task: task.trim(), photo_url: photoUrl })
    .select()
    .single();
  if (error) {
    console.error("Kunne ikke lagre bevis", error);
    return;
  }

  const member = state.leaderboard.find((item) => item.name === user);
  const nextScore = member ? member.score + 1 : 1;
  const { data: updated } = await supabase
    .from("leaderboard")
    .update({ score: nextScore })
    .eq("name", user)
    .select()
    .single();

  state.leaderboard = state.leaderboard.map((item) =>
    item.name === user ? updated || { ...item, score: nextScore } : item
  );
  state.proofs = [data, ...state.proofs];
  renderLeaderboard();
  renderProofs();
}

function showInventoryAlert(message) {
  if (!elements.inventoryAlert) return;
  elements.inventoryAlert.textContent = message;
  elements.inventoryAlert.hidden = false;
  if (alertTimeoutId) {
    clearTimeout(alertTimeoutId);
  }
  alertTimeoutId = setTimeout(() => {
    elements.inventoryAlert.hidden = true;
  }, 4000);
}

async function handleEventSubmit(event) {
  event.preventDefault();
  await addEvent(
    elements.eventDate.value,
    elements.eventTitle.value,
    elements.eventNote.value || ""
  );
  elements.eventForm.reset();
}

async function handleInventorySubmit(event) {
  event.preventDefault();
  await addInventory(
    elements.itemName.value,
    elements.itemType.value,
    elements.itemMax.value
  );
  elements.inventoryForm.reset();
}

async function handleProofSubmit(event) {
  event.preventDefault();
  const file = elements.proofPhoto.files[0];
  if (!file) return;
  const fileExt = file.name.split(".").pop();
  const filePath = `${Date.now()}-${Math.random().toString(16).slice(2)}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: false });
  if (uploadError) {
    console.error("Kunne ikke laste opp bilde", uploadError);
    return;
  }
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  await addProof({
    user: elements.proofUser.value,
    task: elements.proofTask.value,
    photoUrl: data.publicUrl,
  });
  elements.proofForm.reset();
}

function bindEvents() {
  elements.prevMonth.addEventListener("click", () => {
    state.monthOffset -= 1;
    renderCalendar();
  });

  elements.nextMonth.addEventListener("click", () => {
    state.monthOffset += 1;
    renderCalendar();
  });

  elements.eventForm.addEventListener("submit", handleEventSubmit);
  elements.inventoryForm.addEventListener("submit", handleInventorySubmit);
  elements.proofForm.addEventListener("submit", handleProofSubmit);
  elements.itemType.addEventListener("change", () => {
    const isPercent = elements.itemType.value === "percent";
    elements.itemMax.disabled = isPercent;
  });
}

async function loadData() {
  const [eventsRes, inventoryRes, leaderboardRes, proofsRes] = await Promise.all([
    supabase.from("events").select("*"),
    supabase.from("inventory").select("*"),
    supabase.from("leaderboard").select("*"),
    supabase.from("proofs").select("*"),
  ]);

  state.events = eventsRes.data || [];
  state.inventory = normalizeInventory(inventoryRes.data || []);
  state.leaderboard = normalizeLeaderboard(leaderboardRes.data || []);
  state.proofs = proofsRes.data || [];

  if (state.events.length === 0) {
    const inserts = await supabase.from("events").insert(defaultData.events).select();
    state.events = inserts.data || state.events;
  }

  if (state.inventory.length === 0) {
    const inserts = await supabase.from("inventory").insert(defaultData.inventory).select();
    state.inventory = normalizeInventory(inserts.data || state.inventory);
  }

  if (state.leaderboard.length === 0) {
    const inserts = await supabase.from("leaderboard").insert(defaultData.leaderboard).select();
    state.leaderboard = normalizeLeaderboard(inserts.data || state.leaderboard);
  }
}

async function updateInventoryItem(id, patch) {
  await supabase.from("inventory").update(patch).eq("id", id);
}

function scheduleInventorySave(id) {
  if (inventorySaveTimers.has(id)) {
    clearTimeout(inventorySaveTimers.get(id));
  }
  const timer = setTimeout(() => {
    const item = state.inventory.find((entry) => entry.id === id);
    if (item) {
      updateInventoryItem(id, { qty: item.qty });
    }
    inventorySaveTimers.delete(id);
  }, 300);
  inventorySaveTimers.set(id, timer);
}

async function init() {
  await loadData();
  renderToday();
  renderCalendar();
  renderInventory();
  renderLeaderboard();
  renderProofs();
  bindEvents();
  elements.itemMax.disabled = elements.itemType.value === "percent";
}

init();
