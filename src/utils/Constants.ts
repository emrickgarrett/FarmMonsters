// Game dimensions
export const TILE_SIZE = 16;
export const SCALE = 3;
export const SCALED_TILE = TILE_SIZE * SCALE;
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// Map dimensions (in tiles)
export const FARM_WIDTH = 40;
export const FARM_HEIGHT = 30;

// Farm planting area (tile grid coordinates, inclusive)
export const FARM_AREA = { minX: 8, maxX: 23, minY: 8, maxY: 21 } as const;

// Player
export const PLAYER_SPEED = 120;
export const INTERACTION_RANGE = SCALED_TILE * 1.2;

// Time system
export const DAY_LENGTH_MS = 360_000; // 6 minutes real time = 1 game day
export const HOURS_PER_DAY = 24;
export const WAKE_HOUR = 6;
export const SLEEP_HOUR = 2; // 2 AM forced sleep
export const MS_PER_GAME_HOUR = DAY_LENGTH_MS / HOURS_PER_DAY;

// Seasons
export const DAYS_PER_SEASON = 28;
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export type Season = typeof SEASONS[number];

// Hotbar
export const HOTBAR_SLOTS = 9;

// Inventory
export const INVENTORY_SIZE = 27;

// Monster party
export const MAX_PARTY_SIZE = 6;
export const MAX_MOVES = 4;

// Monster types
export const MONSTER_TYPES = [
  'Fire', 'Water', 'Grass', 'Earth',
  'Electric', 'Dark', 'Light', 'Normal'
] as const;
export type MonsterType = typeof MONSTER_TYPES[number];

// Skills
export const SKILL_NAMES = [
  'Mining', 'Fishing', 'Harvesting',
  'Woodcutting', 'Social', 'Battle'
] as const;
export type SkillName = typeof SKILL_NAMES[number];
export const MAX_SKILL_LEVEL = 10;

// Tool types
export const TOOL_TYPES = [
  'Hoe', 'WateringCan', 'Axe', 'Shovel',
  'FishingRod', 'Pickaxe'
] as const;
export type ToolType = typeof TOOL_TYPES[number];

// Energy costs per tool action
export const ENERGY_COSTS: Record<ToolType, number> = {
  Hoe: 4,
  WateringCan: 2,
  Axe: 6,
  Shovel: 4,
  FishingRod: 8,
  Pickaxe: 6,
};

// Colors for placeholder assets
export const TYPE_COLORS: Record<MonsterType, number> = {
  Fire: 0xff4444,
  Water: 0x4488ff,
  Grass: 0x44cc44,
  Earth: 0x886644,
  Electric: 0xffcc00,
  Dark: 0x553366,
  Light: 0xffffaa,
  Normal: 0xaaaaaa,
};

export const TERRAIN_COLORS = {
  grass: 0x5a8a3c,
  dirt: 0x8b6914,
  tilled: 0x6b4914,
  watered: 0x4b3510,
  water: 0x3366aa,
  sand: 0xc2b280,
  stone: 0x777777,
  wood: 0x8b6914,
  path: 0xc4a46c,
  wall: 0x555555,
  roof: 0x884422,
  door: 0x664400,
  fence: 0x996633,
};

// Crop display colors for placeholder sprites
export const CROP_COLORS: Record<string, number> = {
  parsnip: 0xffa54f,
  potato: 0xc4a46c,
  tomato: 0xff4444,
  pumpkin: 0xff8800,
};

// UI Colors (Stardew Valley / Harvest Moon inspired)
export const UI_COLORS = {
  panelBg: 0x4a3728,
  panelBorder: 0x8b6914,
  panelBorderLight: 0xc4a46c,
  hotbarBg: 0x3a2718,
  hotbarSlot: 0x5a4738,
  hotbarSelected: 0xffcc00,
  textPrimary: '#ffffff',
  textSecondary: '#c4a46c',
  textHighlight: '#ffcc00',
  dialogBg: 0x2a1f14,
  dialogBorder: 0x8b6914,
  buttonBg: 0x5a4738,
  buttonHover: 0x7a6758,
  healthBar: 0x44cc44,
  manaBar: 0x4488ff,
  xpBar: 0xffcc00,
};

// Scene keys
export const SCENES = {
  BOOT: 'BootScene',
  MENU: 'MenuScene',
  WORLD: 'WorldScene',
  BATTLE: 'BattleScene',
  UI: 'UIScene',
} as const;

// Event names
export const EVENTS = {
  // Time
  TIME_TICK: 'time:tick',
  HOUR_CHANGED: 'time:hourChanged',
  DAY_CHANGED: 'time:dayChanged',
  SEASON_CHANGED: 'time:seasonChanged',

  // Player
  PLAYER_MOVED: 'player:moved',
  PLAYER_INTERACT: 'player:interact',
  PLAYER_TOOL_USE: 'player:toolUse',
  ENERGY_CHANGED: 'player:energyChanged',
  GOLD_CHANGED: 'player:goldChanged',

  // Hotbar
  HOTBAR_SELECT: 'hotbar:select',
  HOTBAR_UPDATED: 'hotbar:updated',

  // Inventory
  ITEM_ADDED: 'inventory:itemAdded',
  ITEM_REMOVED: 'inventory:itemRemoved',
  ITEM_USED: 'inventory:itemUsed',

  // Dialog
  DIALOG_OPEN: 'dialog:open',
  DIALOG_CLOSE: 'dialog:close',
  DIALOG_CHOICE: 'dialog:choice',

  // Battle
  BATTLE_START: 'battle:start',
  BATTLE_END: 'battle:end',
  BATTLE_ACTION: 'battle:action',

  // Farming
  TILE_TILLED: 'farm:tileTilled',
  CROP_PLANTED: 'farm:cropPlanted',
  CROP_WATERED: 'farm:cropWatered',
  CROP_HARVESTED: 'farm:cropHarvested',
  FARM_TILE_UPDATED: 'farm:tileUpdated',
  FARM_CROP_WITHERED: 'farm:cropWithered',
  SHIPPING_BIN_ADD: 'farm:shippingAdd',
  SHIPPING_BIN_SELL: 'farm:shippingSell',

  // Monsters
  MONSTER_CAUGHT: 'monster:caught',
  MONSTER_LEVEL_UP: 'monster:levelUp',
  MONSTER_EVOLVED: 'monster:evolved',

  // Skills
  SKILL_XP_GAINED: 'skill:xpGained',
  SKILL_LEVEL_UP: 'skill:levelUp',

  // Save
  GAME_SAVED: 'save:saved',
  GAME_LOADED: 'save:loaded',

  // UI
  MENU_OPEN: 'ui:menuOpen',
  MENU_CLOSE: 'ui:menuClose',
  NOTIFICATION: 'ui:notification',
  INVENTORY_OPEN: 'ui:inventoryOpen',
  INVENTORY_CLOSE: 'ui:inventoryClose',
  STORAGE_OPEN: 'ui:storageOpen',
  STORAGE_CLOSE: 'ui:storageClose',
} as const;

// Utility: convert pixel position to tile grid coordinate
export function pixelToGrid(px: number, py: number): { gx: number; gy: number } {
  return {
    gx: Math.floor(px / SCALED_TILE),
    gy: Math.floor(py / SCALED_TILE),
  };
}

// Utility: convert tile grid coordinate to pixel center position
export function gridToPixel(gx: number, gy: number): { px: number; py: number } {
  return {
    px: gx * SCALED_TILE + SCALED_TILE / 2,
    py: gy * SCALED_TILE + SCALED_TILE / 2,
  };
}
