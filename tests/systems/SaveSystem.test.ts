import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveSystem } from '../../src/systems/SaveSystem';
import { createNewSaveData, SAVE_KEY_PREFIX, SAVE_VERSION, MAX_SAVE_SLOTS } from '../../src/models/SaveData';
import { createDefaultPlayerData } from '../../src/models/PlayerData';
import { EventBus } from '../../src/utils/EventBus';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('SaveSystem', () => {
  beforeEach(() => {
    localStorageMock.clear();
    EventBus.resetInstance();
  });

  it('should save and load data from a slot', () => {
    const playerData = createDefaultPlayerData('TestPlayer');
    const saveData = createNewSaveData('TestPlayer', playerData);

    const saved = SaveSystem.saveToSlot(0, saveData);
    expect(saved).toBe(true);

    const loaded = SaveSystem.loadFromSlot(0);
    expect(loaded).not.toBeNull();
    expect(loaded!.player.name).toBe('TestPlayer');
    expect(loaded!.version).toBe(SAVE_VERSION);
  });

  it('should return null for empty slots', () => {
    const loaded = SaveSystem.loadFromSlot(0);
    expect(loaded).toBeNull();
  });

  it('should reject invalid slot numbers', () => {
    const playerData = createDefaultPlayerData('Test');
    const saveData = createNewSaveData('Test', playerData);

    expect(SaveSystem.saveToSlot(-1, saveData)).toBe(false);
    expect(SaveSystem.saveToSlot(MAX_SAVE_SLOTS, saveData)).toBe(false);
    expect(SaveSystem.loadFromSlot(-1)).toBeNull();
    expect(SaveSystem.loadFromSlot(MAX_SAVE_SLOTS)).toBeNull();
  });

  it('should delete save data from a slot', () => {
    const playerData = createDefaultPlayerData('Test');
    const saveData = createNewSaveData('Test', playerData);

    SaveSystem.saveToSlot(1, saveData);
    expect(SaveSystem.loadFromSlot(1)).not.toBeNull();

    SaveSystem.deleteSlot(1);
    expect(SaveSystem.loadFromSlot(1)).toBeNull();
  });

  it('should get slot info for all slots', () => {
    const playerData = createDefaultPlayerData('Alice');
    const saveData = createNewSaveData('Alice', playerData);
    SaveSystem.saveToSlot(0, saveData);

    const info = SaveSystem.getSlotInfo();
    expect(info).toHaveLength(MAX_SAVE_SLOTS);
    expect(info[0].exists).toBe(true);
    expect(info[0].name).toBe('Alice');
    expect(info[1].exists).toBe(false);
    expect(info[2].exists).toBe(false);
  });

  it('should update timestamp on save', () => {
    const playerData = createDefaultPlayerData('Test');
    const saveData = createNewSaveData('Test', playerData);
    const before = Date.now();

    SaveSystem.saveToSlot(0, saveData);

    const loaded = SaveSystem.loadFromSlot(0);
    expect(loaded!.timestamp).toBeGreaterThanOrEqual(before);
  });

  it('should preserve all save data fields', () => {
    const playerData = createDefaultPlayerData('Farmer');
    const saveData = createNewSaveData('Farmer', playerData);
    saveData.player.gold = 1234;
    saveData.time.day = 15;
    saveData.time.season = 'Fall';
    saveData.player.position = { x: 100, y: 200 };
    saveData.inventory = [{ id: 'test_item', quantity: 5 }];

    SaveSystem.saveToSlot(2, saveData);
    const loaded = SaveSystem.loadFromSlot(2);

    expect(loaded!.player.gold).toBe(1234);
    expect(loaded!.time.day).toBe(15);
    expect(loaded!.time.season).toBe('Fall');
    expect(loaded!.player.position).toEqual({ x: 100, y: 200 });
    expect(loaded!.inventory).toHaveLength(1);
    expect(loaded!.inventory[0].id).toBe('test_item');
  });

  it('should handle save to same slot (overwrite)', () => {
    const pd1 = createDefaultPlayerData('First');
    const save1 = createNewSaveData('First', pd1);
    SaveSystem.saveToSlot(0, save1);

    const pd2 = createDefaultPlayerData('Second');
    const save2 = createNewSaveData('Second', pd2);
    SaveSystem.saveToSlot(0, save2);

    const loaded = SaveSystem.loadFromSlot(0);
    expect(loaded!.player.name).toBe('Second');
  });
});
