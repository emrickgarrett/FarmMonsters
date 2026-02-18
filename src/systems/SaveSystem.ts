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

  /** Migrate save data from older versions to current schema. */
  private static migrate(data: SaveData): SaveData {
    // v1 -> v2: Add chests, shippingBin, expanded FarmTile fields
    if ((data.version ?? 1) < 2) {
      (data as any).chests = (data as any).chests ?? {};
      (data as any).shippingBin = (data as any).shippingBin ?? [];
      // Ensure FarmTile entries have new fields
      if (data.farmTiles) {
        for (const tile of data.farmTiles) {
          tile.daysGrown = tile.daysGrown ?? 0;
          tile.seasonPlanted = tile.seasonPlanted ?? undefined;
        }
      }
    }

    data.version = SAVE_VERSION;
    return data;
  }
}
