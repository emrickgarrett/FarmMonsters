import { SaveData, SAVE_KEY_PREFIX, SAVE_VERSION, MAX_SAVE_SLOTS } from '../models/SaveData';
import { EventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';

export class SaveSystem {
  static saveToSlot(slot: number, data: SaveData): boolean {
    if (slot < 0 || slot >= MAX_SAVE_SLOTS) return false;

    try {
      data.timestamp = Date.now();
      data.version = SAVE_VERSION;
      const key = `${SAVE_KEY_PREFIX}${slot}`;
      localStorage.setItem(key, JSON.stringify(data));
      EventBus.getInstance().emit(EVENTS.GAME_SAVED, slot);
      return true;
    } catch (e) {
      console.error('Failed to save game:', e);
      return false;
    }
  }

  static loadFromSlot(slot: number): SaveData | null {
    if (slot < 0 || slot >= MAX_SAVE_SLOTS) return null;

    try {
      const key = `${SAVE_KEY_PREFIX}${slot}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const data: SaveData = JSON.parse(raw);

      // Version migration if needed
      if (data.version < SAVE_VERSION) {
        return SaveSystem.migrate(data);
      }

      return data;
    } catch (e) {
      console.error('Failed to load save:', e);
      return null;
    }
  }

  static deleteSlot(slot: number): boolean {
    if (slot < 0 || slot >= MAX_SAVE_SLOTS) return false;
    try {
      localStorage.removeItem(`${SAVE_KEY_PREFIX}${slot}`);
      return true;
    } catch {
      return false;
    }
  }

  static getSlotInfo(): { slot: number; exists: boolean; name?: string; day?: number; timestamp?: number }[] {
    const info = [];
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      const data = SaveSystem.loadFromSlot(i);
      if (data) {
        info.push({
          slot: i,
          exists: true,
          name: data.player.name,
          day: data.time.day,
          timestamp: data.timestamp,
        });
      } else {
        info.push({ slot: i, exists: false });
      }
    }
    return info;
  }

  /** Migrate save data from older versions */
  private static migrate(data: SaveData): SaveData {
    // Future migration logic goes here
    // For now, just update the version
    data.version = SAVE_VERSION;
    return data;
  }
}
