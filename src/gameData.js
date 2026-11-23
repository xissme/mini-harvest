export const TILE_SIZE = 32;
export const COLS = 24; // 768px
export const ROWS = 14; // 448px

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export const CROPS = {
  turnip: {
    name: 'Turnip',
    seedCost: 50,
    sellPrice: 120,
    daysToGrow: 3,
    color: '#f8f9fa',
    leafColor: '#43aa8b',
  },
  potato: {
    name: 'Potato',
    seedCost: 80,
    sellPrice: 200,
    daysToGrow: 4,
    color: '#d4a373',
    leafColor: '#52b788',
  },
};

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
  map[3][4] = TILE.HOUSE_DOOR;

  // Shipping Bin & Sumur
  map[3][7] = TILE.SHIPPING_BIN;
  map[3][18] = TILE.WELL;

  // Area Ladang (tengah bawah, disesuaikan ke ROWS = 14)
  for (let r = 5; r <= 11; r++) {
    for (let c = 4; c <= 19; c++) {
      map[r][c] = TILE.FARM_DIRT;
    }
  }

  return map;
}
