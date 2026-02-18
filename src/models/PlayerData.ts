import { SkillName, SKILL_NAMES, MAX_SKILL_LEVEL } from '../utils/Constants';

export interface SkillData {
  name: SkillName;
  level: number;
  xp: number;
  xpToNext: number;
  selectedPerks: string[];
}

export interface EquipmentSlots {
  hat: string | null;
  shirt: string | null;
  pants: string | null;
  boots: string | null;
  accessory: string | null;
  tool: string | null;
}

export interface PlayerStats {
  battlesWon: number;
  battlesLost: number;
  creaturesCollected: number;
  uniqueCreaturesCollected: number;
  cropsHarvested: number;
  fishCaught: number;
  itemsCrafted: number;
  daysPlayed: number;
  totalEarnings: number;
}

export interface PlayerData {
  name: string;
  gold: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  position: { x: number; y: number };
  currentMap: string;
  facing: 'up' | 'down' | 'left' | 'right';
  skills: SkillData[];
  equipment: EquipmentSlots;
  stats: PlayerStats;
  hotbar: (string | null)[];
  appearance: {
    skinColor: number;
    hairColor: number;
    hairStyle: number;
  };
}

/** XP required for each skill level (exponential curve) */
export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level >= MAX_SKILL_LEVEL) return Infinity;
  return Math.floor(100 * Math.pow(1.8, level - 1));
}

export function createDefaultPlayerData(name: string = 'Farmer'): PlayerData {
  const skills: SkillData[] = SKILL_NAMES.map((skillName) => ({
    name: skillName,
    level: 0,
    xp: 0,
    xpToNext: xpForLevel(1),
    selectedPerks: [],
  }));

  return {
    name,
    gold: 500,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    position: { x: 320, y: 320 },
    currentMap: 'farm',
    facing: 'down',
    skills,
    equipment: {
      hat: null,
      shirt: null,
      pants: null,
      boots: null,
      accessory: null,
      tool: null,
    },
    stats: {
      battlesWon: 0,
      battlesLost: 0,
      creaturesCollected: 0,
      uniqueCreaturesCollected: 0,
      cropsHarvested: 0,
      fishCaught: 0,
      itemsCrafted: 0,
      daysPlayed: 0,
      totalEarnings: 0,
    },
    hotbar: ['hoe', 'watering_can', 'axe', 'shovel', 'fishing_rod', 'pickaxe', null, null, null],
    appearance: {
      skinColor: 0xffcc99,
      hairColor: 0x553311,
      hairStyle: 0,
    },
  };
}
