export const TILE_SIZE = 32;
export const COLS = 24; // 768px
export const ROWS = 16; // 512px

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Tipe Tile Dasar
export const TILE = {
  GRASS: 0,
  FARM_DIRT: 1,
  TILLED: 2,
  WATERED: 3,
  HOUSE_WALL: 4,
  HOUSE_DOOR: 5,
  SHIPPING_BIN: 6,
  WELL: 7,
  FENCE: 8,
};

// Definisi Tanaman
export const CROPS = {
  turnip: {
    name: 'Turnip',
    seedCost: 50,
    sellPrice: 120,
    daysToGrow: 3,
  },
};

// Membuat Peta Awal
export function createInitialMap() {
  const map = Array.from({ length: ROWS }, () => Array(COLS).fill(TILE.GRASS));

  // Pagar keliling
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        map[r][c] = TILE.FENCE;
      }
    }
  }

  // Rumah Pemain (kiri atas)
  for (let r = 1; r <= 3; r++) {
    for (let c = 2; c <= 5; c++) {
      map[r][c] = TILE.HOUSE_WALL;
    }
  }
  map[3][4] = TILE.HOUSE_DOOR; // Pintu tidur

  // Shipping Bin (sebelah rumah)
  map[3][7] = TILE.SHIPPING_BIN;

  // Sumur Air (kanan atas)
  map[3][18] = TILE.WELL;

  // Area Ladang (tengah bawah)
  for (let r = 6; r <= 12; r++) {
    for (let c = 4; c <= 19; c++) {
      map[r][c] = TILE.FARM_DIRT;
    }
  }

  return map;
}
