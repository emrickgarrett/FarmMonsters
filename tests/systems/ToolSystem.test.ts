import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolSystem } from '../../src/systems/ToolSystem';
import { FarmingSystem } from '../../src/systems/FarmingSystem';
import { InventorySystem } from '../../src/systems/InventorySystem';
import { ItemRegistry } from '../../src/data/ItemRegistry';
import { EventBus } from '../../src/utils/EventBus';
import { EVENTS, ENERGY_COSTS } from '../../src/utils/Constants';
import { CropDefinition } from '../../src/models/CropData';
import { ItemDefinition } from '../../src/models/ItemData';

const testItems: ItemDefinition[] = [
  { id: 'hoe', name: 'Hoe', category: 'tool', toolType: 'Hoe', stackable: false, textureKey: 'icon_hoe', description: 'Tills soil.' },
  { id: 'watering_can', name: 'Watering Can', category: 'tool', toolType: 'WateringCan', stackable: false, textureKey: 'icon_watering_can', description: 'Waters soil.' },
  { id: 'axe', name: 'Axe', category: 'tool', toolType: 'Axe', stackable: false, textureKey: 'icon_axe', description: 'Chops trees.' },
  { id: 'shovel', name: 'Shovel', category: 'tool', toolType: 'Shovel', stackable: false, textureKey: 'icon_shovel', description: 'Digs.' },
  { id: 'fishing_rod', name: 'Fishing Rod', category: 'tool', toolType: 'FishingRod', stackable: false, textureKey: 'icon_fishing_rod', description: 'Catches fish.' },
  { id: 'pickaxe', name: 'Pickaxe', category: 'tool', toolType: 'Pickaxe', stackable: false, textureKey: 'icon_pickaxe', description: 'Breaks rocks.' },
  { id: 'parsnip_seeds', name: 'Parsnip Seeds', category: 'seed', cropId: 'parsnip', stackable: true, maxStack: 99, textureKey: 'icon_seed_parsnip', sellPrice: 10, description: 'Seeds.' },
  { id: 'tomato_seeds', name: 'Tomato Seeds', category: 'seed', cropId: 'tomato', stackable: true, maxStack: 99, textureKey: 'icon_seed_tomato', sellPrice: 25, description: 'Seeds.' },
  { id: 'parsnip', name: 'Parsnip', category: 'crop', stackable: true, maxStack: 99, textureKey: 'icon_crop_parsnip', sellPrice: 35, description: 'Root vegetable.' },
];

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

describe('ToolSystem', () => {
  let farm: FarmingSystem;
  let inv: InventorySystem;
  let tools: ToolSystem;

  beforeEach(() => {
    EventBus.resetInstance();
    ItemRegistry.reset();
    ItemRegistry.loadItems(testItems);
    ItemRegistry.loadCrops(testCrops);

    farm = new FarmingSystem();
    inv = new InventorySystem();
    tools = new ToolSystem(farm, inv);
    tools.setEnergy(100, 100);
  });

  describe('useItem - tools', () => {
    it('should till with hoe', () => {
      const result = tools.useItem('hoe', 10, 10, 'Spring', 1);
      expect(result.success).toBe(true);
      expect(farm.getTile(10, 10)!.state).toBe('tilled');
    });

    it('should water with watering can', () => {
      farm.till(10, 10);
      const result = tools.useItem('watering_can', 10, 10, 'Spring', 1);
      expect(result.success).toBe(true);
      expect(farm.getTile(10, 10)!.isWatered).toBe(true);
    });

    it('should dig up with shovel', () => {
      farm.till(10, 10);
      const result = tools.useItem('shovel', 10, 10, 'Spring', 1);
      expect(result.success).toBe(true);
      expect(farm.getTile(10, 10)).toBeUndefined();
    });

    it('should consume energy on successful tool use', () => {
      tools.useItem('hoe', 10, 10, 'Spring', 1);
      expect(tools.getEnergy()).toBe(100 - ENERGY_COSTS.Hoe);
    });

    it('should not consume energy on failed tool use', () => {
      tools.useItem('hoe', 0, 0, 'Spring', 1); // Outside farm area
      expect(tools.getEnergy()).toBe(100);
    });

    it('should fail when energy is too low', () => {
      tools.setEnergy(1, 100); // Less than any tool cost
      const result = tools.useItem('hoe', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
      expect(result.message).toBe("You're too tired!");
    });

    it('should emit ENERGY_CHANGED on successful tool use', () => {
      const bus = EventBus.getInstance();
      const handler = vi.fn();
      bus.on(EVENTS.ENERGY_CHANGED, handler);

      tools.useItem('hoe', 10, 10, 'Spring', 1);
      expect(handler).toHaveBeenCalledWith(100 - ENERGY_COSTS.Hoe, 100);
    });

    it('should show message when watering nothing', () => {
      const result = tools.useItem('watering_can', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Nothing to water here.');
    });

    it('should show message when tilling already tilled soil', () => {
      farm.till(10, 10);
      const result = tools.useItem('hoe', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
      expect(result.message).toBe('This soil is already tilled.');
    });

    it('should show message when tilling a blocked tile', () => {
      farm.blockTile(10, 10);
      const result = tools.useItem('hoe', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Something is in the way!');
    });

    it('should allow tilling after obstacle is removed', () => {
      farm.blockTile(10, 10);
      expect(tools.useItem('hoe', 10, 10, 'Spring', 1).success).toBe(false);

      farm.unblockTile(10, 10);
      const result = tools.useItem('hoe', 10, 10, 'Spring', 1);
      expect(result.success).toBe(true);
    });

    it('should show message for fishing rod without water', () => {
      const result = tools.useItem('fishing_rod', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Find a body of water to fish!');
    });
  });

  describe('useItem - seeds', () => {
    it('should plant a seed on tilled soil', () => {
      inv.addItem('parsnip_seeds', 10);
      farm.till(10, 10);

      const result = tools.useItem('parsnip_seeds', 10, 10, 'Spring', 1);
      expect(result.success).toBe(true);
      expect(farm.getTile(10, 10)!.state).toBe('planted');
      expect(farm.getTile(10, 10)!.cropId).toBe('parsnip');
    });

    it('should consume seed from inventory on planting', () => {
      inv.addItem('parsnip_seeds', 10);
      farm.till(10, 10);

      tools.useItem('parsnip_seeds', 10, 10, 'Spring', 1);
      expect(inv.getItemCount('parsnip_seeds')).toBe(9);
    });

    it('should fail to plant without seeds in inventory', () => {
      farm.till(10, 10);
      const result = tools.useItem('parsnip_seeds', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
      expect(result.message).toBe("You don't have any more seeds.");
    });

    it('should fail to plant in wrong season', () => {
      inv.addItem('parsnip_seeds', 10);
      farm.till(10, 10);
      const result = tools.useItem('parsnip_seeds', 10, 10, 'Summer', 1);
      expect(result.success).toBe(false);
      expect(result.message).toContain("can't be planted in Summer");
    });

    it('should fail to plant on untilled soil with message', () => {
      inv.addItem('parsnip_seeds', 10);
      const result = tools.useItem('parsnip_seeds', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Till the soil first!');
    });

    it('should fail to plant on already planted tile', () => {
      inv.addItem('parsnip_seeds', 10);
      farm.till(10, 10);
      tools.useItem('parsnip_seeds', 10, 10, 'Spring', 1);

      const result = tools.useItem('parsnip_seeds', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Something is already planted here.');
    });
  });

  describe('harvestCrop', () => {
    it('should harvest a grown crop and add to inventory', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      farm.getTile(10, 10)!.state = 'grown';

      const result = tools.harvestCrop(10, 10);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Harvested');
      expect(inv.hasItem('parsnip')).toBe(true);
    });

    it('should emit SKILL_XP_GAINED on harvest', () => {
      const bus = EventBus.getInstance();
      const handler = vi.fn();
      bus.on(EVENTS.SKILL_XP_GAINED, handler);

      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      farm.getTile(10, 10)!.state = 'grown';

      tools.harvestCrop(10, 10);
      expect(handler).toHaveBeenCalledWith('Harvesting', 8);
    });

    it('should fail to harvest non-grown crop', () => {
      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      // Still planted, not grown

      const result = tools.harvestCrop(10, 10);
      expect(result.success).toBe(false);
    });

    it('should warn when inventory is full on harvest', () => {
      // Fill inventory
      for (let i = 0; i < 27; i++) {
        inv.addItem('hoe', 1);
      }

      farm.till(10, 10);
      farm.plant(10, 10, 'parsnip_seeds', 'Spring', 1);
      farm.getTile(10, 10)!.state = 'grown';

      const result = tools.harvestCrop(10, 10);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Inventory is full');
    });
  });

  describe('energy management', () => {
    it('should track energy via setEnergy / getEnergy', () => {
      tools.setEnergy(50, 100);
      expect(tools.getEnergy()).toBe(50);
    });

    it('should reduce energy progressively with tool use', () => {
      farm.till(10, 10); // -4 energy
      tools.useItem('hoe', 10, 10, 'Spring', 1); // Fails (already tilled), no energy spent
      // Till a different tile
      const result = tools.useItem('hoe', 11, 11, 'Spring', 1); // -4 energy
      expect(result.success).toBe(true);
      expect(tools.getEnergy()).toBe(100 - ENERGY_COSTS.Hoe);
    });
  });

  describe('unknown items', () => {
    it('should return failure for unknown item IDs', () => {
      const result = tools.useItem('nonexistent', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
    });

    it('should return failure for non-tool/non-seed items', () => {
      const result = tools.useItem('parsnip', 10, 10, 'Spring', 1);
      expect(result.success).toBe(false);
    });
  });
});
