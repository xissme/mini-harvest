import {
  TILE_SIZE,
  COLS,
  ROWS,
  DAYS_OF_WEEK,
  TILE,
  CROPS,
  createInitialMap,
} from './gameData.js';

const SAVE_KEY = 'mini_harvest_save_v1';
const CROP_KEYS = Object.keys(CROPS);

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hudDay = document.getElementById('hud-day');
const hudGold = document.getElementById('hud-gold');
const hudStamina = document.getElementById('hud-stamina');
const toolbarEl = document.getElementById('toolbar');
const toastEl = document.getElementById('toast');

function createFreshState() {
  return {
    day: 1,
    timeMinutes: 360, // 06:00
    gold: 500,
    stamina: 100,
    maxStamina: 100,
    waterCan: 20,
    maxWaterCan: 20,
    activeSeed: 'turnip',
    seeds: { turnip: 5, potato: 2 },
    harvested: { turnip: 0, potato: 0 },
    shippingValue: 0,
    selectedTool: 0, // 0: Hoe, 1: Seed, 2: Watering Can, 3: Hands/Harvest
    map: createInitialMap(),
    crops: {},
    player: {
      x: 4 * TILE_SIZE,
      y: 4 * TILE_SIZE,
      size: 24,
      speed: 155,
      dir: 'down',
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createFreshState();
    const parsed = JSON.parse(raw);
    const fresh = createFreshState();
    return {
      ...fresh,
      ...parsed,
      seeds: { ...fresh.seeds, ...(parsed.seeds || {}) },
      harvested: { ...fresh.harvested, ...(parsed.harvested || {}) },
      player: { ...fresh.player, ...(parsed.player || {}) },
    };
  } catch {
    return createFreshState();
  }
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Abaikan jika storage penuh/diblokir
  }
}

let state = loadState();
const keys = {};
let toastTimer = null;

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2400);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;

  if (['1', '2', '3', '4'].includes(k)) {
    state.selectedTool = Number(k) - 1;
    renderToolbar();
  }

  if (k === 'q') {
    const idx = CROP_KEYS.indexOf(state.activeSeed);
    state.activeSeed = CROP_KEYS[(idx + 1) % CROP_KEYS.length];
    const info = CROPS[state.activeSeed];
    showToast(`Bibit aktif: ${info.name} (Beli ${info.seedCost}G / Jual ${info.sellPrice}G)`);
    renderToolbar();
  }

  if (e.code === 'Space') {
    e.preventDefault();
    handleAction();
  }

  if (k === 'b') {
    buySeed();
  }

  if (k === 'l') {
    localStorage.removeItem(SAVE_KEY);
    state = createFreshState();
    showToast('Save dihapus. Game direset ke Day 1.');
    renderToolbar();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

function buySeed() {
  const cropInfo = CROPS[state.activeSeed];
  if (state.gold >= cropInfo.seedCost) {
    state.gold -= cropInfo.seedCost;
    state.seeds[state.activeSeed] += 1;
    showToast(`Membeli 1 Bibit ${cropInfo.name} (-${cropInfo.seedCost} G)`);
    renderToolbar();
  } else {
    showToast(`Gold tidak cukup untuk beli ${cropInfo.name} (${cropInfo.seedCost} G)!`);
  }
}

function getTargetTile() {
  const centerX = state.player.x + state.player.size / 2;
  const centerY = state.player.y + state.player.size / 2;
  let col = Math.floor(centerX / TILE_SIZE);
  let row = Math.floor(centerY / TILE_SIZE);

  if (state.player.dir === 'up') row -= 1;
  if (state.player.dir === 'down') row += 1;
  if (state.player.dir === 'left') col -= 1;
  if (state.player.dir === 'right') col += 1;

  return { row, col };
}

function handleAction() {
  const { row, col } = getTargetTile();
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

  const tile = state.map[row][col];
  const key = `${row},${col}`;
  const crop = state.crops[key];

  if (tile === TILE.HOUSE_DOOR) {
    sleepNextDay();
    return;
  }

  if (tile === TILE.WELL) {
    state.waterCan = state.maxWaterCan;
    showToast('Gembor diisi penuh di sumur!');
    renderToolbar();
    return;
  }

  if (tile === TILE.SHIPPING_BIN) {
    let totalEarned = 0;
    let totalItems = 0;
    for (const cropType of CROP_KEYS) {
      const qty = state.harvested[cropType] || 0;
      if (qty > 0) {
        totalEarned += qty * CROPS[cropType].sellPrice;
        totalItems += qty;
        state.harvested[cropType] = 0;
      }
    }

    if (totalItems > 0) {
      state.shippingValue += totalEarned;
      showToast(`Menaruh ${totalItems} hasil panen (+${totalEarned} G besok pagi)`);
      renderToolbar();
    } else {
      showToast('Tidak ada hasil panen untuk dijual.');
    }
    return;
  }

  if (crop && crop.daysGrown >= CROPS[crop.type].daysToGrow) {
    const cropName = CROPS[crop.type].name;
    delete state.crops[key];
    state.harvested[crop.type] = (state.harvested[crop.type] || 0) + 1;
    showToast(`Panen ${cropName}! Masukkan ke kotak JUAL.`);
    renderToolbar();
    return;
  }

  if (state.selectedTool === 0) {
    if (tile === TILE.FARM_DIRT) {
      if (!consumeStamina(4)) return;
      state.map[row][col] = TILE.TILLED;
    }
  } else if (state.selectedTool === 1) {
    if ((tile === TILE.TILLED || tile === TILE.WATERED) && !crop) {
      const seedType = state.activeSeed;
      if (state.seeds[seedType] > 0) {
        state.seeds[seedType] -= 1;
        state.crops[key] = {
          type: seedType,
          daysGrown: 0,
          wateredToday: tile === TILE.WATERED,
        };
        renderToolbar();
      } else {
        showToast(`Bibit ${CROPS[seedType].name} habis! Tekan [B] untuk beli.`);
      }
    }
  } else if (state.selectedTool === 2) {
    if (tile === TILE.TILLED || tile === TILE.WATERED) {
      if (state.waterCan <= 0) {
        showToast('Air di gembor habis! Isi di kotak AIR.');
        return;
      }
      if (!consumeStamina(2)) return;
      state.waterCan -= 1;
      state.map[row][col] = TILE.WATERED;
      if (crop) crop.wateredToday = true;
      renderToolbar();
    }
  }
}

function consumeStamina(amount) {
  if (state.stamina < amount) {
    showToast('Terlalu lelah! Tidur di pintu TIDUR untuk pulihkan stamina.');
    return false;
  }
  state.stamina -= amount;
  return true;
}

function sleepNextDay() {
  state.day += 1;
  state.timeMinutes = 360;
  state.stamina = state.maxStamina;

  let notif = `Selamat pagi! Spring Day ${state.day}`;
  if (state.shippingValue > 0) {
    state.gold += state.shippingValue;
    notif = `Hari ${state.day}! Pendapatan panen masuk: +${state.shippingValue} G`;
    state.shippingValue = 0;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${r},${c}`;
      const crop = state.crops[key];
      if (crop && crop.wateredToday) {
        crop.daysGrown += 1;
        crop.wateredToday = false;
      }
      if (state.map[r][c] === TILE.WATERED) {
        state.map[r][c] = TILE.TILLED;
      }
    }
  }

  saveState();
  showToast(notif);
  renderToolbar();
}

function isWalkable(nx, ny) {
  const pad = 2;
  const corners = [
    [nx + pad, ny + pad],
    [nx + state.player.size - pad, ny + pad],
    [nx + pad, ny + state.player.size - pad],
    [nx + state.player.size - pad, ny + state.player.size - pad],
  ];

  const solidTiles = [TILE.FENCE, TILE.HOUSE_WALL, TILE.SHIPPING_BIN, TILE.WELL];

  for (const [cx, cy] of corners) {
    const col = Math.floor(cx / TILE_SIZE);
    const row = Math.floor(cy / TILE_SIZE);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    if (solidTiles.includes(state.map[row][col])) return false;
  }
  return true;
}

function update(dt) {
  let dx = 0;
  let dy = 0;
  if (keys['w'] || keys['arrowup']) {
    dy -= 1;
    state.player.dir = 'up';
  }
  if (keys['s'] || keys['arrowdown']) {
    dy += 1;
    state.player.dir = 'down';
  }
  if (keys['a'] || keys['arrowleft']) {
    dx -= 1;
    state.player.dir = 'left';
  }
  if (keys['d'] || keys['arrowright']) {
    dx += 1;
    state.player.dir = 'right';
  }

  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  const nextX = state.player.x + dx * state.player.speed * dt;
  const nextY = state.player.y + dy * state.player.speed * dt;

  if (isWalkable(nextX, state.player.y)) state.player.x = nextX;
  if (isWalkable(state.player.x, nextY)) state.player.y = nextY;

  state.timeMinutes += dt * 10;
  if (state.timeMinutes >= 1440) {
    sleepNextDay();
    state.stamina = 60;
    saveState();
    showToast('Ketiduran larut malam! Stamina hanya pulih sebagian.');
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = state.map[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      if (tile === TILE.GRASS) ctx.fillStyle = '#6a994e';
      else if (tile === TILE.FARM_DIRT) ctx.fillStyle = '#bc8a5f';
      else if (tile === TILE.TILLED) ctx.fillStyle = '#8b5e34';
      else if (tile === TILE.WATERED) ctx.fillStyle = '#583101';
      else if (tile === TILE.FENCE) ctx.fillStyle = '#5c4738';
      else if (tile === TILE.HOUSE_WALL) ctx.fillStyle = '#d4a373';
      else if (tile === TILE.HOUSE_DOOR) ctx.fillStyle = '#7f4f24';
      else if (tile === TILE.SHIPPING_BIN) ctx.fillStyle = '#e07a5f';
      else if (tile === TILE.WELL) ctx.fillStyle = '#4ea8de';

      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      if (tile === TILE.HOUSE_DOOR) ctx.fillText('TIDUR', x + 2, y + 20);
      if (tile === TILE.SHIPPING_BIN) ctx.fillText('JUAL', x + 4, y + 20);
      if (tile === TILE.WELL) ctx.fillText('AIR', x + 7, y + 20);

      const crop = state.crops[`${r},${c}`];
      if (crop) {
        const info = CROPS[crop.type];
        if (crop.daysGrown === 0) {
          ctx.fillStyle = '#e9c46a';
          ctx.fillRect(x + 12, y + 12, 8, 8);
        } else if (crop.daysGrown < info.daysToGrow) {
          ctx.fillStyle = info.leafColor;
          ctx.fillRect(x + 8, y + 8, 16, 16);
        } else {
          ctx.fillStyle = info.color;
          ctx.beginPath();
          ctx.arc(x + 16, y + 18, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = info.leafColor;
          ctx.fillRect(x + 11, y + 4, 10, 7);
        }
      }
    }
  }

  const target = getTargetTile();
  if (target.row >= 0 && target.row < ROWS && target.col >= 0 && target.col < COLS) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(target.col * TILE_SIZE, target.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.lineWidth = 1;
  }

  const p = state.player;
  ctx.fillStyle = '#e63946';
  ctx.fillRect(p.x, p.y + 8, p.size, p.size - 8);
  ctx.fillStyle = '#ffcdb2';
  ctx.fillRect(p.x + 4, p.y + 4, p.size - 8, 10);
  ctx.fillStyle = '#1d3557';
  ctx.fillRect(p.x + 2, p.y, p.size - 4, 7);

  const hours = String(Math.floor(state.timeMinutes / 60)).padStart(2, '0');
  const mins = String(Math.floor(state.timeMinutes % 60)).padStart(2, '0');
  const weekday = DAYS_OF_WEEK[state.day % 7];
  hudDay.textContent = `Spring Day ${state.day} (${weekday}) | ${hours}:${mins}`;
  hudGold.textContent = `Gold: ${state.gold} G`;
  hudStamina.textContent = `Stamina: ${state.stamina}/${state.maxStamina}`;
}

function renderToolbar() {
  const activeCrop = CROPS[state.activeSeed];
  const totalHarvested = CROP_KEYS.reduce((sum, k) => sum + (state.harvested[k] || 0), 0);

  const tools = [
    `[1] Cangkul`,
    `[2] ${activeCrop.name} (${state.seeds[state.activeSeed]})`,
    `[3] Gembor (${state.waterCan}/${state.maxWaterCan})`,
    `[4] Panen (${totalHarvested})`,
  ];

  toolbarEl.innerHTML = tools
    .map(
      (label, idx) =>
        `<div class="tool-slot ${state.selectedTool === idx ? 'active' : ''}">${label}</div>`
    )
    .join('');
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

renderToolbar();
requestAnimationFrame(loop);
