import { describe, it, expect } from 'vitest';
import { createDefaultPlayerData, xpForLevel } from '../../src/models/PlayerData';
import { SKILL_NAMES, MAX_SKILL_LEVEL } from '../../src/utils/Constants';

describe('PlayerData', () => {
  it('should create default player data with name', () => {
    const player = createDefaultPlayerData('TestFarmer');
    expect(player.name).toBe('TestFarmer');
    expect(player.gold).toBe(500);
    expect(player.health).toBe(100);
    expect(player.energy).toBe(100);
  });

  it('should create default player with "Farmer" if no name given', () => {
    const player = createDefaultPlayerData();
    expect(player.name).toBe('Farmer');
  });

  it('should have all skills initialized', () => {
    const player = createDefaultPlayerData('Test');
    expect(player.skills).toHaveLength(SKILL_NAMES.length);

    for (const skill of player.skills) {
      expect(skill.level).toBe(0);
      expect(skill.xp).toBe(0);
      expect(SKILL_NAMES).toContain(skill.name);
    }
  });

  it('should have default hotbar with tools', () => {
    const player = createDefaultPlayerData('Test');
    expect(player.hotbar).toHaveLength(9);
    expect(player.hotbar[0]).toBe('hoe');
    expect(player.hotbar[1]).toBe('watering_can');
    expect(player.hotbar[2]).toBe('axe');
    expect(player.hotbar[3]).toBe('shovel');
    expect(player.hotbar[4]).toBe('fishing_rod');
    expect(player.hotbar[5]).toBe('pickaxe');
    expect(player.hotbar[6]).toBeNull();
  });

  it('should have empty equipment slots', () => {
    const player = createDefaultPlayerData('Test');
    expect(player.equipment.hat).toBeNull();
    expect(player.equipment.shirt).toBeNull();
    expect(player.equipment.pants).toBeNull();
    expect(player.equipment.boots).toBeNull();
    expect(player.equipment.accessory).toBeNull();
  });

  it('should have zeroed stats', () => {
    const player = createDefaultPlayerData('Test');
    expect(player.stats.battlesWon).toBe(0);
    expect(player.stats.creaturesCollected).toBe(0);
    expect(player.stats.daysPlayed).toBe(0);
  });

  it('should have default appearance', () => {
    const player = createDefaultPlayerData('Test');
    expect(player.appearance).toBeDefined();
    expect(player.appearance.skinColor).toBe(0xffcc99);
  });
});

describe('xpForLevel', () => {
  it('should return 0 for level 0', () => {
    expect(xpForLevel(0)).toBe(0);
  });

  it('should return 100 for level 1', () => {
    expect(xpForLevel(1)).toBe(100);
  });

  it('should increase exponentially', () => {
    const level2 = xpForLevel(2);
    const level3 = xpForLevel(3);
    expect(level3).toBeGreaterThan(level2);
    expect(level2).toBeGreaterThan(100);
  });

  it('should return Infinity for max level', () => {
    expect(xpForLevel(MAX_SKILL_LEVEL)).toBe(Infinity);
  });

  it('should return positive values for all valid levels', () => {
    for (let i = 1; i < MAX_SKILL_LEVEL; i++) {
      expect(xpForLevel(i)).toBeGreaterThan(0);
      expect(xpForLevel(i)).toBeLessThan(Infinity);
    }
  });
});
