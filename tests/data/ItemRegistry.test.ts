import { describe, it, expect, beforeEach } from 'vitest';
import { ItemRegistry } from '../../src/data/ItemRegistry';
import { ItemDefinition } from '../../src/models/ItemData';
import { CropDefinition } from '../../src/models/CropData';

const sampleItems: ItemDefinition[] = [
  { id: 'hoe', name: 'Hoe', category: 'tool', toolType: 'Hoe', stackable: false, textureKey: 'icon_hoe', description: 'Tills soil.' },
  { id: 'parsnip_seeds', name: 'Parsnip Seeds', category: 'seed', cropId: 'parsnip', stackable: true, maxStack: 99, textureKey: 'icon_seed_parsnip', sellPrice: 10, description: 'Plant in spring.' },
  { id: 'parsnip', name: 'Parsnip', category: 'crop', stackable: true, maxStack: 99, textureKey: 'icon_crop_parsnip', sellPrice: 35, description: 'A root vegetable.' },
  { id: 'wood', name: 'Wood', category: 'material', stackable: true, maxStack: 999, textureKey: 'icon_wood', sellPrice: 2, description: 'Lumber.' },
];

const sampleCrops: CropDefinition[] = [
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

describe('ItemRegistry', () => {
  beforeEach(() => {
    ItemRegistry.reset();
  });

  describe('loadItems', () => {
    it('should load items and retrieve them by ID', () => {
      ItemRegistry.loadItems(sampleItems);

      expect(ItemRegistry.getItem('hoe')).toBeDefined();
      expect(ItemRegistry.getItem('hoe')!.name).toBe('Hoe');
      expect(ItemRegistry.getItem('parsnip_seeds')!.category).toBe('seed');
    });

    it('should return undefined for unknown item IDs', () => {
      ItemRegistry.loadItems(sampleItems);
      expect(ItemRegistry.getItem('nonexistent')).toBeUndefined();
    });

    it('should clear previous items on reload', () => {
      ItemRegistry.loadItems(sampleItems);
      ItemRegistry.loadItems([sampleItems[0]]);
      expect(ItemRegistry.getItem('hoe')).toBeDefined();
      expect(ItemRegistry.getItem('parsnip_seeds')).toBeUndefined();
    });

    it('should return all items', () => {
      ItemRegistry.loadItems(sampleItems);
      expect(ItemRegistry.getAllItems()).toHaveLength(4);
    });
  });

  describe('loadCrops', () => {
    it('should load crops and retrieve them by ID', () => {
      ItemRegistry.loadCrops(sampleCrops);

      expect(ItemRegistry.getCrop('parsnip')).toBeDefined();
      expect(ItemRegistry.getCrop('parsnip')!.totalGrowDays).toBe(4);
    });

    it('should return undefined for unknown crop IDs', () => {
      ItemRegistry.loadCrops(sampleCrops);
      expect(ItemRegistry.getCrop('nonexistent')).toBeUndefined();
    });

    it('should return all crops', () => {
      ItemRegistry.loadCrops(sampleCrops);
      expect(ItemRegistry.getAllCrops()).toHaveLength(2);
    });
  });

  describe('seed-crop cross-references', () => {
    beforeEach(() => {
      ItemRegistry.loadItems(sampleItems);
      ItemRegistry.loadCrops(sampleCrops);
    });

    it('should get crop definition for a seed ID', () => {
      const crop = ItemRegistry.getCropForSeed('parsnip_seeds');
      expect(crop).toBeDefined();
      expect(crop!.id).toBe('parsnip');
      expect(crop!.totalGrowDays).toBe(4);
    });

    it('should return undefined for non-seed item', () => {
      expect(ItemRegistry.getCropForSeed('hoe')).toBeUndefined();
    });

    it('should get seed ID for a crop ID', () => {
      expect(ItemRegistry.getSeedForCrop('parsnip')).toBe('parsnip_seeds');
      expect(ItemRegistry.getSeedForCrop('tomato')).toBe('tomato_seeds');
    });

    it('should return undefined for unknown crop-to-seed lookup', () => {
      expect(ItemRegistry.getSeedForCrop('nonexistent')).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should clear all data', () => {
      ItemRegistry.loadItems(sampleItems);
      ItemRegistry.loadCrops(sampleCrops);
      ItemRegistry.reset();

      expect(ItemRegistry.getItem('hoe')).toBeUndefined();
      expect(ItemRegistry.getCrop('parsnip')).toBeUndefined();
      expect(ItemRegistry.getCropForSeed('parsnip_seeds')).toBeUndefined();
      expect(ItemRegistry.getAllItems()).toHaveLength(0);
      expect(ItemRegistry.getAllCrops()).toHaveLength(0);
    });
  });
});
