import { PlayerData } from './PlayerData';
import { Season } from '../utils/Constants';

export interface InventoryItem {
  id: string;
  quantity: number;
}

export interface FarmTile {
  x: number;
  y: number;
  state: 'untilled' | 'tilled' | 'planted' | 'watered' | 'grown';
  cropId?: string;
  growthStage?: number;
  dayPlanted?: number;
  isWatered?: boolean;
}

export interface MonsterSaveData {
  id: string;
  speciesId: string;
  nickname: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  specialAttack: number;
  specialDefense: number;
  moves: string[];
  heldItem: string | null;
  isInParty: boolean;
}

export interface FarmMonsterAssignment {
  monsterId: string;
  task: string;
  area: { x: number; y: number; width: number; height: number };
}

export interface SaveData {
  version: number;
  timestamp: number;
  player: PlayerData;
  inventory: InventoryItem[];
  monsters: MonsterSaveData[];
  party: string[]; // monster IDs in party order
  farmTiles: FarmTile[];
  farmMonsters: FarmMonsterAssignment[];
  time: {
    day: number;
    season: Season;
    year: number;
    hour: number;
    minute: number;
  };
  flags: Record<string, boolean>; // story/quest flags
  settings: GameSettings;
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  showHotkeys: boolean;
}

export const SAVE_VERSION = 1;
export const MAX_SAVE_SLOTS = 3;
export const SAVE_KEY_PREFIX = 'farmmonsters_save_';
export const SETTINGS_KEY = 'farmmonsters_settings';

export function createDefaultSettings(): GameSettings {
  return {
    masterVolume: 0.8,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    showHotkeys: true,
  };
}

export function createNewSaveData(playerName: string, playerData?: PlayerData): SaveData {
  // Import dynamically avoided - caller should pass playerData or use the import directly
  const player = playerData ?? {
    name: playerName,
    gold: 500,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    position: { x: 320, y: 320 },
    currentMap: 'farm',
    facing: 'down' as const,
    skills: [],
    equipment: { hat: null, shirt: null, pants: null, boots: null, accessory: null, tool: null },
    stats: { battlesWon: 0, battlesLost: 0, creaturesCollected: 0, uniqueCreaturesCollected: 0, cropsHarvested: 0, fishCaught: 0, itemsCrafted: 0, daysPlayed: 0, totalEarnings: 0 },
    hotbar: ['hoe', 'watering_can', 'axe', 'shovel', 'fishing_rod', 'pickaxe', null, null, null],
    appearance: { skinColor: 0xffcc99, hairColor: 0x553311, hairStyle: 0 },
  };
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    player,
    inventory: [
      { id: 'parsnip_seeds', quantity: 15 },
      { id: 'hoe', quantity: 1 },
      { id: 'watering_can', quantity: 1 },
      { id: 'axe', quantity: 1 },
      { id: 'shovel', quantity: 1 },
      { id: 'fishing_rod', quantity: 1 },
      { id: 'pickaxe', quantity: 1 },
    ],
    monsters: [],
    party: [],
    farmTiles: [],
    farmMonsters: [],
    time: {
      day: 1,
      season: 'Spring',
      year: 1,
      hour: 6,
      minute: 0,
    },
    flags: {},
    settings: createDefaultSettings(),
  };
}
