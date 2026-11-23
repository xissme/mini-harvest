import {
  TILE_SIZE,
  COLS,
  ROWS,
  DAYS_OF_WEEK,
  TILE,
  CROPS,
  createInitialMap,
} from './gameData.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hudDay = document.getElementById('hud-day');
const hudGold = document.getElementById('hud-gold');
const hudStamina = document.getElementById('hud-stamina');
const toolbarEl = document.getElementById('toolbar');
const toastEl = document.getElementById('toast');

// State Utama Game
const state = {
  day: 1,
  timeMinutes: 360, // 06:00 pagi
  gold: 500,
  stamina: 100,
  maxStamina: 100,
  waterCan: 20,
  maxWaterCan: 20,
  seeds: { turnip: 5 },
  harvested: { turnip: 0 },
  shippingValue: 0,
  selectedTool: 0, // 0: Hoe, 1: Seed, 2: Watering Can, 3: Hands/Harvest
  map: createInitialMap(),
  crops: {}, // key: "r,c" -> { type: 'turnip', daysGrown: 0, wateredToday: false }
  player: {
    x: 4 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    size: 24,
    speed: 150,
    dir: 'down', // up, down, left, right
  },
};

const keys = {};
let toastTimer = null;

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2400);
}

// Input Keyboard
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;

  if (['1', '2', '3', '4'].includes(k)) {
    state.selectedTool = Number(k) - 1;
    renderToolbar();
  }

  if (e.code === 'Space') {
    e.preventDefault();
    handleAction();
  }

  if (k === 'b') {
    buySeed();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

function buySeed() {
  const cost = CROPS.turnip.seedCost;
  if (state.gold >= cost) {
    state.gold -= cost;
    state.seeds.turnip += 1;
    showToast(`Membeli 1 Bibit Turnip (-${cost} G)`);
    renderToolbar();
  } else {
    showToast('Gold tidak cukup untuk beli bibit!');
  }
}

// Mendapatkan koordinat grid tepat di depan pemain
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

// Eksekusi Alat & Interaksi Objek
function handleAction() {
  const { row, col } = getTargetTile();
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

  const tile = state.map[row][col];
  const key = `${row},${col}`;
  const crop = state.crops[key];

  // 1. Interaksi Objek Khusus
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
    if (state.harvested.turnip > 0) {
      const earned = state.harvested.turnip * CROPS.turnip.sellPrice;
      state.shippingValue += earned;
      showToast(`Menaruh ${state.harvested.turnip} Turnip (+${earned} G besok pagi)`);
      state.harvested.turnip = 0;
      renderToolbar();
    } else {
      showToast('Tidak ada hasil panen untuk dijual.');
    }
    return;
  }

  // 2. Panen jika tanaman sudah matang (berlaku untuk alat apa saja jika pakai tangan/slot 4 atau langsung)
  if (crop && crop.daysGrown >= CROPS[crop.type].daysToGrow) {
    delete state.crops[key];
    state.harvested[crop.type] += 1;
    showToast('Panen Turnip! Simpan ke Shipping Bin di sebelah rumah.');
    renderToolbar();
    return;
  }

  // 3. Penggunaan Alat Pertanian
  if (state.selectedTool === 0) {
    // Cangkul
    if (tile === TILE.FARM_DIRT) {
      if (!consumeStamina(4)) return;
      state.map[row][col] = TILE.TILLED;
    }
  } else if (state.selectedTool === 1) {
    // Tanam Bibit
    if ((tile === TILE.TILLED || tile === TILE.WATERED) && !crop) {
      if (state.seeds.turnip > 0) {
        state.seeds.turnip -= 1;
        state.crops[key] = {
          type: 'turnip',
          daysGrown: 0,
          wateredToday: tile === TILE.WATERED,
        };
        renderToolbar();
      } else {
        showToast('Bibit habis! Tekan [B] untuk beli (50G).');
      }
    }
  } else if (state.selectedTool === 2) {
    // Siram Air
    if (tile === TILE.TILLED || tile === TILE.WATERED) {
      if (state.waterCan <= 0) {
        showToast('Air di gembor habis! Isi di sumur (kanan atas).');
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
    showToast('Terlalu lelah! Tidur di pintu rumah untuk pulihkan stamina.');
    return false;
  }
  state.stamina -= amount;
  return true;
}

// Pergantian Hari saat Tidur
function sleepNextDay() {
  state.day += 1;
  state.timeMinutes = 360; // Reset ke 06:00
  state.stamina = state.maxStamina;

  // Cairkan uang dari Shipping Bin
  if (state.shippingValue > 0) {
    state.gold += state.shippingValue;
    showToast(`Hari ${state.day}! Pendapatan panen masuk: +${state.shippingValue} G`);
    state.shippingValue = 0;
  } else {
    showToast(`Selamat pagi! Memasuki Spring Day ${state.day}`);
  }

  // Proses pertumbuhan tanaman & keringkan tanah
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
}

// Cek Tabrakan Dinding/Objek Padat
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

// Update Logika Per Frame
function update(dt) {
  // Gerak Pemain
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

  // Waktu berjalan (1 detik nyata = 10 menit dalam game)
  state.timeMinutes += dt * 10;
  if (state.timeMinutes >= 1440) {
    // Pingsan otomatis jam 24:00
    sleepNextDay();
    state.stamina = 60;
    showToast('Ketiduran larut malam! Stamina hanya pulih sebagian.');
  }
}

// Render Visual ke Canvas
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = state.map[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      // Warna Dasar Tile
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

      // Label ikon sederhana untuk bangunan
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      if (tile === TILE.HOUSE_DOOR) ctx.fillText('TIDUR', x + 2, y + 20);
      if (tile === TILE.SHIPPING_BIN) ctx.fillText('JUAL', x + 4, y + 20);
      if (tile === TILE.WELL) ctx.fillText('AIR', x + 7, y + 20);

      // Gambar Tanaman
      const crop = state.crops[`${r},${c}`];
      if (crop) {
        const maxDays = CROPS[crop.type].daysToGrow;
        if (crop.daysGrown === 0) {
          // Bibit
          ctx.fillStyle = '#e9c46a';
          ctx.fillRect(x + 12, y + 12, 8, 8);
        } else if (crop.daysGrown < maxDays) {
          // Tunas
          ctx.fillStyle = '#90be6d';
          ctx.fillRect(x + 8, y + 8, 16, 16);
        } else {
          // Siap Panen (Turnip Putih-Ungu)
          ctx.fillStyle = '#f8f9fa';
          ctx.beginPath();
          ctx.arc(x + 16, y + 18, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#43aa8b';
          ctx.fillRect(x + 11, y + 4, 10, 7);
        }
      }
    }
  }

  // Highlight kotak target di depan pemain
  const target = getTargetTile();
  if (target.row >= 0 && target.row < ROWS && target.col >= 0 && target.col < COLS) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(target.col * TILE_SIZE, target.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    ctx.lineWidth = 1;
  }

  // Gambar Karakter Pemain (Topi Biru ala Pete)
  const p = state.player;
  ctx.fillStyle = '#e63946'; // Baju
  ctx.fillRect(p.x, p.y + 8, p.size, p.size - 8);
  ctx.fillStyle = '#ffcdb2'; // Wajah
  ctx.fillRect(p.x + 4, p.y + 4, p.size - 8, 10);
  ctx.fillStyle = '#1d3557'; // Topi biru ikonik
  ctx.fillRect(p.x + 2, p.y, p.size - 4, 7);

  // Update HUD
  const hours = String(Math.floor(state.timeMinutes / 60)).padStart(2, '0');
  const mins = String(Math.floor(state.timeMinutes % 60)).padStart(2, '0');
  const weekday = DAYS_OF_WEEK[state.day % 7];
  hudDay.textContent = `Spring Day ${state.day} (${weekday}) | ${hours}:${mins}`;
  hudGold.textContent = `Gold: ${state.gold} G`;
  hudStamina.textContent = `Stamina: ${state.stamina}/${state.maxStamina}`;
}

function renderToolbar() {
  const tools = [
    `[1] Cangkul`,
    `[2] Bibit (${state.seeds.turnip})`,
    `[3] Gembor (${state.waterCan}/${state.maxWaterCan})`,
    `[4] Tangan (Panen: ${state.harvested.turnip})`,
  ];

  toolbarEl.innerHTML = tools
    .map(
      (label, idx) =>
        `<div class="tool-slot ${state.selectedTool === idx ? 'active' : ''}">${label}</div>`
    )
    .join('');
}

// Main Loop
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
