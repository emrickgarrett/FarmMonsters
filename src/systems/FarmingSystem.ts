import { FarmTile } from '../models/SaveData';
import { CropDefinition } from '../models/CropData';
import { ItemRegistry } from '../data/ItemRegistry';
import { EventBus } from '../utils/EventBus';
import { EVENTS, FARM_AREA, Season } from '../utils/Constants';

/**
 * Pure-logic farming system. No Phaser dependency.
 * Manages farm tile states: till, plant, water, grow, harvest.
 * Communicates via EventBus.
 */
export class FarmingSystem {
  private tiles: Map<string, FarmTile> = new Map();
  private blockedTiles: Set<string> = new Set();
  private bus: EventBus;

  constructor(initialTiles?: FarmTile[]) {
    this.bus = EventBus.getInstance();
    if (initialTiles) {
      for (const tile of initialTiles) {
        this.tiles.set(this.key(tile.x, tile.y), { ...tile });
      }
    }
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  /** Check if grid coordinates are within the plantable farm area. */
  isInFarmArea(gx: number, gy: number): boolean {
    return gx >= FARM_AREA.minX && gx <= FARM_AREA.maxX &&
           gy >= FARM_AREA.minY && gy <= FARM_AREA.maxY;
  }

  /** Mark a tile as blocked by an obstacle (rock, stump, etc.). */
  blockTile(gx: number, gy: number): void {
    this.blockedTiles.add(this.key(gx, gy));
  }

  /** Unblock a tile (when an obstacle is removed). */
  unblockTile(gx: number, gy: number): void {
    this.blockedTiles.delete(this.key(gx, gy));
  }

  /** Check if a tile is blocked by an obstacle. */
  isBlocked(gx: number, gy: number): boolean {
    return this.blockedTiles.has(this.key(gx, gy));
  }

  /** Get the tile state at grid position, or undefined if untouched. */
  getTile(gx: number, gy: number): FarmTile | undefined {
    return this.tiles.get(this.key(gx, gy));
  }

  // ─── TILL ───────────────────────────────────────────────

  /**
   * Till a dirt tile. Returns true if successful.
   */
  till(gx: number, gy: number): boolean {
    if (!this.isInFarmArea(gx, gy)) return false;
    if (this.isBlocked(gx, gy)) return false;

    const existing = this.getTile(gx, gy);
    // Can only till untouched dirt or withered crops
    if (existing && existing.state !== 'untilled' && existing.state !== 'withered') {
      return false;
    }

    const tile: FarmTile = {
      x: gx, y: gy,
      state: 'tilled',
      isWatered: false,
    };
    this.tiles.set(this.key(gx, gy), tile);
    this.bus.emit(EVENTS.TILE_TILLED, gx, gy);
    this.bus.emit(EVENTS.FARM_TILE_UPDATED, gx, gy, tile);
    return true;
  }

  // ─── PLANT ──────────────────────────────────────────────

  /**
   * Plant a seed at the given tile. Returns true if successful.
   * Caller is responsible for removing the seed from inventory.
   */
  plant(gx: number, gy: number, seedId: string, currentSeason: Season, currentDay: number): boolean {
    if (!this.isInFarmArea(gx, gy)) return false;

    const tile = this.getTile(gx, gy);
    if (!tile || tile.state !== 'tilled') return false;

    const cropDef = ItemRegistry.getCropForSeed(seedId);
    if (!cropDef) return false;

    // Season validation
    if (!cropDef.seasons.includes(currentSeason)) return false;

    tile.state = 'planted';
    tile.cropId = cropDef.id;
    tile.growthStage = 0;
    tile.daysGrown = 0;
    tile.dayPlanted = currentDay;
    tile.seasonPlanted = currentSeason;

    this.bus.emit(EVENTS.CROP_PLANTED, gx, gy, cropDef.id);
    this.bus.emit(EVENTS.FARM_TILE_UPDATED, gx, gy, tile);
    return true;
  }

  // ─── WATER ──────────────────────────────────────────────

  /**
   * Water a tile. Returns true if successful.
   */
  water(gx: number, gy: number): boolean {
    if (!this.isInFarmArea(gx, gy)) return false;

    const tile = this.getTile(gx, gy);
    if (!tile) return false;
    if (tile.state !== 'tilled' && tile.state !== 'planted' && tile.state !== 'grown') return false;

    tile.isWatered = true;
    this.bus.emit(EVENTS.CROP_WATERED, gx, gy);
    this.bus.emit(EVENTS.FARM_TILE_UPDATED, gx, gy, tile);
    return true;
  }

  // ─── HARVEST ────────────────────────────────────────────

  /**
   * Harvest a fully grown crop. Returns the harvest result or null if unable.
   */
  harvest(gx: number, gy: number): { cropId: string; quantity: number; xp: number } | null {
    const tile = this.getTile(gx, gy);
    if (!tile || tile.state !== 'grown' || !tile.cropId) return null;

    const cropDef = ItemRegistry.getCrop(tile.cropId);
    if (!cropDef) return null;

    const quantity = cropDef.harvestYield.min +
      Math.floor(Math.random() * (cropDef.harvestYield.max - cropDef.harvestYield.min + 1));

    const result = {
      cropId: cropDef.id,
      quantity,
      xp: cropDef.xpOnHarvest,
    };

    // Handle regrow vs reset
    if (cropDef.regrows && cropDef.regrowDays !== undefined) {
      tile.state = 'planted';
      tile.daysGrown = cropDef.totalGrowDays - cropDef.regrowDays;
      tile.growthStage = this.calculateGrowthStage(tile.daysGrown, cropDef);
      tile.isWatered = false;
    } else {
      // Reset to tilled
      tile.state = 'tilled';
      tile.cropId = undefined;
      tile.growthStage = undefined;
      tile.daysGrown = undefined;
      tile.dayPlanted = undefined;
      tile.seasonPlanted = undefined;
      tile.isWatered = false;
    }

    this.bus.emit(EVENTS.CROP_HARVESTED, gx, gy, result.cropId, result.quantity);
    this.bus.emit(EVENTS.FARM_TILE_UPDATED, gx, gy, tile);
    return result;
  }

  // ─── DIG UP ─────────────────────────────────────────────

  /**
   * Dig up / clear a farm tile back to untilled. Destroys any crop.
   */
  digUp(gx: number, gy: number): boolean {
    if (!this.isInFarmArea(gx, gy)) return false;

    const tile = this.getTile(gx, gy);
    if (!tile || tile.state === 'untilled') return false;

    this.tiles.delete(this.key(gx, gy));
    this.bus.emit(EVENTS.FARM_TILE_UPDATED, gx, gy, { x: gx, y: gy, state: 'untilled' });
    return true;
  }

  // ─── DAILY UPDATE ───────────────────────────────────────

  /**
   * Called at the start of each new day. Processes growth and resets watering.
   * Returns arrays of tiles that changed state (for visual updates).
   */
  onNewDay(currentSeason: Season): {
    grew: FarmTile[];
    withered: FarmTile[];
    waterReset: FarmTile[];
  } {
    const grew: FarmTile[] = [];
    const withered: FarmTile[] = [];
    const waterReset: FarmTile[] = [];

    for (const tile of this.tiles.values()) {
      // Growth: only planted crops that were watered grow
      if (tile.state === 'planted' && tile.cropId) {
        const cropDef = ItemRegistry.getCrop(tile.cropId);
        if (!cropDef) continue;

        // Season check: wither if out of season
        if (!cropDef.seasons.includes(currentSeason)) {
          tile.state = 'withered';
          tile.isWatered = false;
          withered.push({ ...tile });
          this.bus.emit(EVENTS.FARM_CROP_WITHERED, tile.x, tile.y);
          this.bus.emit(EVENTS.FARM_TILE_UPDATED, tile.x, tile.y, tile);
          continue;
        }

        // Grow if watered
        if (tile.isWatered) {
          tile.daysGrown = (tile.daysGrown ?? 0) + 1;
          tile.growthStage = this.calculateGrowthStage(tile.daysGrown, cropDef);

          if (tile.daysGrown >= cropDef.totalGrowDays) {
            tile.state = 'grown';
          }
          grew.push({ ...tile });
          this.bus.emit(EVENTS.FARM_TILE_UPDATED, tile.x, tile.y, tile);
        }
      }

      // Reset watering for all tiles
      if (tile.isWatered) {
        tile.isWatered = false;
        waterReset.push({ ...tile });
      }
    }

    return { grew, withered, waterReset };
  }

  private calculateGrowthStage(daysGrown: number, cropDef: CropDefinition): number {
    const stage = Math.floor(daysGrown / cropDef.daysPerStage);
    return Math.min(stage, cropDef.growthStages);
  }

  // ─── SERIALIZATION ──────────────────────────────────────

  /** Serialize all non-untilled tiles for save. */
  serialize(): FarmTile[] {
    return Array.from(this.tiles.values()).map(tile => ({ ...tile }));
  }

  /** Load farm state from save data. */
  load(tiles: FarmTile[]): void {
    this.tiles.clear();
    for (const tile of tiles) {
      this.tiles.set(this.key(tile.x, tile.y), { ...tile });
    }
  }

  /** Get all non-untilled tiles (for rendering). */
  getAllTiles(): FarmTile[] {
    return Array.from(this.tiles.values());
  }
}
