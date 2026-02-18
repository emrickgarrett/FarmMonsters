import { ItemDefinition } from '../models/ItemData';
import { CropDefinition } from '../models/CropData';

/**
 * Runtime registry that loads and indexes item/crop definitions from JSON data.
 * Provides fast lookups by ID and cross-references between seeds and crops.
 */
export class ItemRegistry {
  private static items: Map<string, ItemDefinition> = new Map();
  private static crops: Map<string, CropDefinition> = new Map();
  private static seedToCrop: Map<string, string> = new Map();
  private static cropToSeed: Map<string, string> = new Map();

  static loadItems(itemDefs: ItemDefinition[]): void {
    ItemRegistry.items.clear();
    for (const item of itemDefs) {
      ItemRegistry.items.set(item.id, item);
    }
  }

  static loadCrops(cropDefs: CropDefinition[]): void {
    ItemRegistry.crops.clear();
    ItemRegistry.seedToCrop.clear();
    ItemRegistry.cropToSeed.clear();
    for (const crop of cropDefs) {
      ItemRegistry.crops.set(crop.id, crop);
      ItemRegistry.seedToCrop.set(crop.seedId, crop.id);
      ItemRegistry.cropToSeed.set(crop.id, crop.seedId);
    }
  }

  static getItem(id: string): ItemDefinition | undefined {
    return ItemRegistry.items.get(id);
  }

  static getCrop(id: string): CropDefinition | undefined {
    return ItemRegistry.crops.get(id);
  }

  /** Given a seed item ID, return the crop it grows. */
  static getCropForSeed(seedId: string): CropDefinition | undefined {
    const cropId = ItemRegistry.seedToCrop.get(seedId);
    return cropId ? ItemRegistry.crops.get(cropId) : undefined;
  }

  /** Given a crop ID, return the seed item ID that plants it. */
  static getSeedForCrop(cropId: string): string | undefined {
    return ItemRegistry.cropToSeed.get(cropId);
  }

  static getAllItems(): ItemDefinition[] {
    return Array.from(ItemRegistry.items.values());
  }

  static getAllCrops(): CropDefinition[] {
    return Array.from(ItemRegistry.crops.values());
  }

  /** Reset all registries (for testing). */
  static reset(): void {
    ItemRegistry.items.clear();
    ItemRegistry.crops.clear();
    ItemRegistry.seedToCrop.clear();
    ItemRegistry.cropToSeed.clear();
  }
}
