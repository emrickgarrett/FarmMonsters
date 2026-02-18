import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FarmingSystem } from '../../src/systems/FarmingSystem';
import { ItemRegistry } from '../../src/data/ItemRegistry';
import { EventBus } from '../../src/utils/EventBus';
import { EVENTS } from '../../src/utils/Constants';
import { CropDefinition } from '../../src/models/CropData';
import { ItemDefinition } from '../../src/models/ItemData';

const testCrops: CropDefinition[] = [
  {
    id: 'parsnip', name: 'Parsnip', seedId: 'parsnip_seeds',
    seasons: ['Spring'], growthStages: 4, daysPerStage: 1, totalGrowDays: 4,
    sellPrice: 35, harvestYield: { min: 1, max: 1 }, xpOnHarvest: 8,
    regrows: false, textureKey: 'crop_parsnip',
  },
  {
    id: 'tomato', name: 'Tomato', seedId: 'tomato_seeds',
    seasons: ['Summer'], growthStages: 5, daysPerStage: 2, totalGrowDays: 10,
    sellPrice: 60, harvestYield: { min: 1, max: 3 }, xpOnHarvest: 12,
    regrows: true, regrowDays: 3, textureKey: 'crop_tomato',
  },
];

const testItems: ItemDefinition[] = [
  { id: 'parsnip_seeds', name: 'Parsnip Seeds', category: 'seed', cropId: 'parsnip', stackable: true, maxStack: 99, textureKey: 'icon_seed_parsnip', sellPrice: 10, description: 'Seeds.' },
  { id: 'tomato_seeds', name: 'Tomato Seeds', category: 'seed', cropId: 'tomato', stackable: true, maxStack: 99, textureKey: 'icon_seed_tomato', sellPrice: 25, description: 'Seeds.' },
];

describe('FarmingSystem', () => {
  let farm: FarmingSystem;

  beforeEach(() => {
    EventBus.resetInstance();
    ItemRegistry.reset();
    ItemRegistry.loadItems(testItems);
    ItemRegistry.loadCrops(testCrops);
    farm = new FarmingSystem();
  });

  describe('isInFarmArea', () => {
    it('should return true for coordinates within farm bounds', () => {
      expect(farm.isInFarmArea(8, 8)).toBe(true);
      expect(farm.isInFarmArea(23, 21)).toBe(true);
      expect(farm.isInFarmArea(15, 15)).toBe(true);
    });

    it('should return false for coordinates outside farm bounds', () => {
      expect(farm.isInFarmArea(7, 8)).toBe(false);
      expect(farm.isInFarmArea(24, 8)).toBe(false);
      expect(farm.isInFarmArea(8, 7)).toBe(false);
      expect(farm.isInFarmArea(8, 22)).toBe(false);
      expect(farm.isInFarmArea(0, 0)).toBe(false);
    });
  });

  describe('blocked tiles', () => {
    it('should block and unblock tiles', () => {
      expect(farm.isBlocked(10, 10)).toBe(false);
      farm.blockTile(10, 10);
      expect(farm.isBlocked(10, 10)).toBe(true);
      farm.unblockTile(10, 10);
      expect(farm.isBlocked(10, 10)).toBe(false);
    });

    it('should prevent tilling on blocked tiles', () => {
      farm.blockTile(10, 10);
      expect(farm.till(10, 10)).toBe(false);
      expect(farm.getTile(10, 10)).toBeUndefined();
    });

    it('should allow tilling after unblocking', () => {
      farm.blockTile(10, 10);
      expect(farm.till(10, 10)).toBe(false);

      farm.unblockTile(10, 10);
      expect(farm.till(10, 10)).toBe(true);
      expect(farm.getTile(10, 10)!.state).toBe('tilled');
    });

    it('should not affect other tiles when one is blocked', () => {
      farm.blockTile(10, 10);
      expect(farm.till(11, 11)).toBe(true);
      expect(farm.getTile(11, 11)!.state).toBe('tilled');
    });

    it('should handle blocking the same tile multiple times gracefully', () => {
      farm.blockTile(10, 10);
      farm.blockTile(10, 10);
      expect(farm.isBlocked(10, 10)).toBe(true);
      farm.unblockTile(10, 10);
      expect(farm.isBlocked(10, 10)).toBe(false);
    });

    it('should handle unblocking a non-blocked tile gracefully', () => {
      farm.unblockTile(10, 10); // Should not throw
      expect(farm.isBlocked(10, 10)).toBe(false);
    });
  });

  describe('till', () => {
    it('should till a valid farm area tile', () => {
      expect(farm.till(10, 10)).toBe(true);
      const tile = farm.getTile(10, 10);
      expect(tile).toBeDefined();
      expect(tile!.state).toBe('tilled');
      expect(tile!.isWatered).toBe(false);
    });

    it('should fail to till outside farm area', () => {
      expect(farm.till(0, 0)).toBe(false);
    });

    it('should fail to till an already tilled tile', () => {
      farm.till(10, 10);
      expect(farm.till(10, 10)).toBe(false);
    });

    it('should allow re-tilling withered crop tiles', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      // Manually set to withered state
      const tile = farm.getTile(10, 10)!;
      tile.state = 'withered';

      expect(farm.till(10, 10)).toBe(true);
      expect(farm.getTile(10, 10)!.state).toBe('tilled');
    });

    it('should emit TILE_TILLED and FARM_TILE_UPDATED events', () => {
      const bus = EventBus.getInstance();
      const tillHandler = vi.fn();
      const updateHandler = vi.fn();
      bus.on(EVENTS.TILE_TILLED, tillHandler);
      bus.on(EVENTS.FARM_TILE_UPDATED, updateHandler);

      farm.till(10, 10);
      expect(tillHandler).toHaveBeenCalledWith(10, 10);
      expect(updateHandler).toHaveBeenCalledWith(10, 10, expect.objectContaining({ state: 'tilled' }));
    });
  });

  describe('plant', () => {
    beforeEach(() => {
      farm.till(10, 10);
    });

    it('should plant a seed on tilled soil', () => {
      expect(farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1)).toBe(true);
      const tile = farm.getTile(10, 10)!;
      expect(tile.state).toBe('planted');
      expect(tile.cropId).toBe('parsnip');
      expect(tile.growthStage).toBe(0);
      expect(tile.daysGrown).toBe(0);
      expect(tile.dayPlanted).toBe(1);
      expect(tile.seasonPlanted).toBe('Spring');
    });

    it('should fail to plant on untilled ground', () => {
      expect(farm.plant(11, 11, 'parsnip_seeds', 'Spring', 1)).toBe(false);
    });

    it('should fail to plant on already planted tile', () => {
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      expect(farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1)).toBe(false);
    });

    it('should fail to plant out of season', () => {
      expect(farm.plant(10, 10, 'parsnip_seeds', 'Summer', 1)).toBe(false);
    });

    it('should fail to plant outside farm area', () => {
      expect(farm.plant(0, 0, 'parsnip_seeds', 'Spring', 1)).toBe(false);
    });

    it('should fail with invalid seed ID', () => {
      expect(farm.plant(10, 10, 'invalid_seeds', 'Spring', 1)).toBe(false);
    });

    it('should emit CROP_PLANTED and FARM_TILE_UPDATED events', () => {
      const bus = EventBus.getInstance();
      const plantHandler = vi.fn();
      bus.on(EVENTS.CROP_PLANTED, plantHandler);

      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      expect(plantHandler).toHaveBeenCalledWith(10, 10, 'parsnip');
    });
  });

  describe('water', () => {
    it('should water a tilled tile', () => {
      farm.till(10, 10);
      expect(farm.water(10, 10)).toBe(true);
      expect(farm.getTile(10, 10)!.isWatered).toBe(true);
    });

    it('should water a planted tile', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      expect(farm.water(10, 10)).toBe(true);
      expect(farm.getTile(10, 10)!.isWatered).toBe(true);
    });

    it('should fail to water untilled ground', () => {
      expect(farm.water(10, 10)).toBe(false);
    });

    it('should fail to water outside farm area', () => {
      expect(farm.water(0, 0)).toBe(false);
    });
  });

  describe('harvest', () => {
    it('should harvest a fully grown crop', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      // Manually set to grown
      farm.getTile(10, 10)!.state = 'grown';

      const result = farm.harvest(10, 10);
      expect(result).not.toBeNull();
      expect(result!.cropId).toBe('parsnip');
      expect(result!.quantity).toBeGreaterThanOrEqual(1);
      expect(result!.xp).toBe(8);
    });

    it('should reset non-regrow crops to tilled after harvest', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      farm.getTile(10, 10)!.state = 'grown';

      farm.harvest(10, 10);
      const tile = farm.getTile(10, 10)!;
      expect(tile.state).toBe('tilled');
      expect(tile.cropId).toBeUndefined();
    });

    it('should keep regrow crops as planted after harvest', () => {
      farm.till(12, 12);
      farm.plant(12, 12, 'tomato_seeds', 'Summer', 1);
      farm.getTile(12, 12)!.state = 'grown';

      farm.harvest(12, 12);
      const tile = farm.getTile(12, 12)!;
      expect(tile.state).toBe('planted');
      expect(tile.cropId).toBe('tomato');
      expect(tile.isWatered).toBe(false);
    });

    it('should fail to harvest if not grown', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      // Still planted, not grown
      expect(farm.harvest(10, 10)).toBeNull();
    });

    it('should fail to harvest empty tiles', () => {
      expect(farm.harvest(10, 10)).toBeNull();
    });
  });

  describe('digUp', () => {
    it('should remove a tilled tile', () => {
      farm.till(10, 10);
      expect(farm.digUp(10, 10)).toBe(true);
      expect(farm.getTile(10, 10)).toBeUndefined();
    });

    it('should remove a planted crop', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      expect(farm.digUp(10, 10)).toBe(true);
      expect(farm.getTile(10, 10)).toBeUndefined();
    });

    it('should fail on untilled ground', () => {
      expect(farm.digUp(10, 10)).toBe(false);
    });

    it('should fail outside farm area', () => {
      expect(farm.digUp(0, 0)).toBe(false);
    });
  });

  describe('onNewDay', () => {
    it('should grow watered planted crops', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      farm.water(10, 10);

      const result = farm.onNewDay('Spring');
      expect(result.grew).toHaveLength(1);
      expect(farm.getTile(10, 10)!.daysGrown).toBe(1);
      expect(farm.getTile(10, 10)!.growthStage).toBe(1);
    });

    it('should not grow un-watered crops', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      // Don't water

      const result = farm.onNewDay('Spring');
      expect(result.grew).toHaveLength(0);
      expect(farm.getTile(10, 10)!.daysGrown).toBe(0);
    });

    it('should transition crop to grown state when fully matured', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);

      // Simulate 4 days of watering (parsnip takes 4 days)
      for (let day = 0; day < 4; day++) {
        farm.water(10, 10);
        farm.onNewDay('Spring');
      }

      expect(farm.getTile(10, 10)!.state).toBe('grown');
    });

    it('should wither crops that are out of season', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);

      const result = farm.onNewDay('Summer');
      expect(result.withered).toHaveLength(1);
      expect(farm.getTile(10, 10)!.state).toBe('withered');
    });

    it('should reset watering on all tiles', () => {
      farm.till(10, 10);
      farm.water(10, 10);

      farm.onNewDay('Spring');
      expect(farm.getTile(10, 10)!.isWatered).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize and restore farm state', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      farm.water(10, 10);
      farm.till(11, 11);

      const saved = farm.serialize();
      expect(saved).toHaveLength(2);

      const farm2 = new FarmingSystem(saved);
      expect(farm2.getTile(10, 10)!.state).toBe('planted');
      expect(farm2.getTile(10, 10)!.isWatered).toBe(true);
      expect(farm2.getTile(11, 11)!.state).toBe('tilled');
    });

    it('should deep copy on serialize', () => {
      farm.till(10, 10);
      const saved = farm.serialize();
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);

      // saved should still show tilled
      expect(saved[0].state).toBe('tilled');
    });

    it('should get all tiles', () => {
      farm.till(10, 10);
      farm.till(11, 11);
      farm.till(12, 12);
      expect(farm.getAllTiles()).toHaveLength(3);
    });
  });
});
