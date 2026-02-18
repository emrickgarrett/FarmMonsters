import { EventBus } from '../utils/EventBus';
import { EVENTS, ENERGY_COSTS, ToolType, Season } from '../utils/Constants';
import { ItemRegistry } from '../data/ItemRegistry';
import { FarmingSystem } from './FarmingSystem';
import { InventorySystem } from './InventorySystem';

export interface ToolActionResult {
  success: boolean;
  message?: string;
}

/**
 * Coordinates tool usage between the hotbar, farming system, and inventory.
 * Pure-logic system. No Phaser dependency.
 */
export class ToolSystem {
  private bus: EventBus;
  private farmingSystem: FarmingSystem;
  private inventorySystem: InventorySystem;

  /** Current player energy — updated externally via setEnergy(). */
  private energy: number = 100;
  private maxEnergy: number = 100;

  constructor(
    farmingSystem: FarmingSystem,
    inventorySystem: InventorySystem
  ) {
    this.bus = EventBus.getInstance();
    this.farmingSystem = farmingSystem;
    this.inventorySystem = inventorySystem;
  }

  setEnergy(energy: number, maxEnergy: number): void {
    this.energy = energy;
    this.maxEnergy = maxEnergy;
  }

  getEnergy(): number {
    return this.energy;
  }

  /**
   * Attempt to use the currently selected item on a farm tile.
   * Returns a result indicating success and an optional message for UI feedback.
   */
  useItem(
    itemId: string,
    gx: number, gy: number,
    currentSeason: Season,
    currentDay: number
  ): ToolActionResult {
    const itemDef = ItemRegistry.getItem(itemId);
    if (!itemDef) return { success: false };

    // Handle by item category
    switch (itemDef.category) {
      case 'tool':
        return this.useTool(itemDef.toolType!, gx, gy);
      case 'seed':
        return this.plantSeed(itemId, gx, gy, currentSeason, currentDay);
      default:
        return { success: false };
    }
  }

  /**
   * Use a tool on a farm tile.
   */
  private useTool(toolType: ToolType, gx: number, gy: number): ToolActionResult {
    const energyCost = ENERGY_COSTS[toolType];

    // Check energy
    if (this.energy < energyCost) {
      return { success: false, message: "You're too tired!" };
    }

    let success = false;
    let message: string | undefined;

    switch (toolType) {
      case 'Hoe':
        success = this.farmingSystem.till(gx, gy);
        if (!success) {
          if (this.farmingSystem.isBlocked(gx, gy)) {
            message = 'Something is in the way!';
          } else {
            const tile = this.farmingSystem.getTile(gx, gy);
            if (tile && tile.state !== 'untilled' && tile.state !== 'withered') {
              message = 'This soil is already tilled.';
            } else if (!this.farmingSystem.isInFarmArea(gx, gy)) {
              message = "Can't till here.";
            }
          }
        }
        break;

      case 'WateringCan':
        success = this.farmingSystem.water(gx, gy);
        if (!success) {
          const tile = this.farmingSystem.getTile(gx, gy);
          if (!tile) {
            message = 'Nothing to water here.';
          }
        }
        break;

      case 'Shovel':
        success = this.farmingSystem.digUp(gx, gy);
        if (!success) {
          message = 'Nothing to dig up here.';
        }
        break;

      case 'Axe':
      case 'Pickaxe':
        // Resource clearing is handled via InteractionSystem in WorldScene
        // ToolSystem just validates energy here
        return { success: false, message: undefined };

      case 'FishingRod':
        return { success: false, message: 'Find a body of water to fish!' };

      default:
        return { success: false };
    }

    if (success) {
      this.energy -= energyCost;
      this.bus.emit(EVENTS.PLAYER_TOOL_USE, toolType, gx, gy);
      this.bus.emit(EVENTS.ENERGY_CHANGED, this.energy, this.maxEnergy);
    }

    return { success, message };
  }

  /**
   * Plant a seed at the given tile.
   */
  private plantSeed(
    seedId: string, gx: number, gy: number,
    currentSeason: Season, currentDay: number
  ): ToolActionResult {
    // Check that we actually have the seed
    if (!this.inventorySystem.hasItem(seedId)) {
      return { success: false, message: "You don't have any more seeds." };
    }

    // Check season
    const cropDef = ItemRegistry.getCropForSeed(seedId);
    if (!cropDef) return { success: false };
    if (!cropDef.seasons.includes(currentSeason)) {
      return { success: false, message: `${cropDef.name} can't be planted in ${currentSeason}.` };
    }

    const success = this.farmingSystem.plant(gx, gy, seedId, currentSeason, currentDay);
    if (success) {
      this.inventorySystem.removeItem(seedId, 1);
      return { success: true };
    }

    // Figure out why it failed
    const tile = this.farmingSystem.getTile(gx, gy);
    if (!tile) {
      return { success: false, message: 'Till the soil first!' };
    }
    if (tile.state !== 'tilled') {
      return { success: false, message: 'Something is already planted here.' };
    }
    return { success: false };
  }

  /**
   * Attempt to harvest the crop at a tile.
   */
  harvestCrop(gx: number, gy: number): ToolActionResult {
    const result = this.farmingSystem.harvest(gx, gy);
    if (!result) {
      return { success: false };
    }

    // Add harvested crop to inventory
    const added = this.inventorySystem.addItem(result.cropId, result.quantity);
    if (!added) {
      return { success: true, message: 'Inventory is full! Item was lost.' };
    }

    // Emit skill XP
    this.bus.emit(EVENTS.SKILL_XP_GAINED, 'Harvesting', result.xp);

    return {
      success: true,
      message: `Harvested ${result.quantity} ${result.cropId}!`,
    };
  }
}
