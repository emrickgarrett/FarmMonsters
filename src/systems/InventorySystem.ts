import { InventoryItem } from '../models/SaveData';
import { ItemRegistry } from '../data/ItemRegistry';
import { EventBus } from '../utils/EventBus';
import { EVENTS, INVENTORY_SIZE } from '../utils/Constants';

/**
 * Pure-logic inventory manager. No Phaser dependency.
 * Communicates via EventBus for UI updates.
 */
export class InventorySystem {
  private items: InventoryItem[] = [];
  private bus: EventBus;

  constructor(initialItems?: InventoryItem[]) {
    this.bus = EventBus.getInstance();
    if (initialItems) {
      // Deep copy to avoid mutating save data reference
      this.items = initialItems.map(item => ({ ...item }));
    }
  }

  /**
   * Add an item to inventory. Returns true if successfully added.
   * Handles stacking for stackable items.
   */
  addItem(id: string, quantity: number = 1): boolean {
    if (quantity <= 0) return false;

    const itemDef = ItemRegistry.getItem(id);
    const maxStack = itemDef?.maxStack ?? (itemDef?.stackable ? 99 : 1);
    const stackable = itemDef?.stackable ?? false;

    if (stackable) {
      // Try to add to existing stack first
      const existing = this.items.find(item => item.id === id);
      if (existing) {
        const spaceInStack = maxStack - existing.quantity;
        const toAdd = Math.min(quantity, spaceInStack);
        if (toAdd > 0) {
          existing.quantity += toAdd;
          this.bus.emit(EVENTS.ITEM_ADDED, id, toAdd);
        }
        // If there's leftover that doesn't fit in the current stack, create new stack
        const leftover = quantity - toAdd;
        if (leftover > 0) {
          return this.addNewStack(id, leftover, maxStack);
        }
        return true;
      }
      // No existing stack, create new
      return this.addNewStack(id, quantity, maxStack);
    } else {
      // Non-stackable: each unit takes one slot
      for (let i = 0; i < quantity; i++) {
        if (this.items.length >= INVENTORY_SIZE) return false;
        this.items.push({ id, quantity: 1 });
        this.bus.emit(EVENTS.ITEM_ADDED, id, 1);
      }
      return true;
    }
  }

  private addNewStack(id: string, quantity: number, maxStack: number): boolean {
    if (this.items.length >= INVENTORY_SIZE) return false;
    const toAdd = Math.min(quantity, maxStack);
    this.items.push({ id, quantity: toAdd });
    this.bus.emit(EVENTS.ITEM_ADDED, id, toAdd);
    return true;
  }

  /**
   * Remove quantity of an item. Returns true if successfully removed.
   */
  removeItem(id: string, quantity: number = 1): boolean {
    if (quantity <= 0) return false;

    const existing = this.items.find(item => item.id === id);
    if (!existing || existing.quantity < quantity) return false;

    existing.quantity -= quantity;
    if (existing.quantity <= 0) {
      this.items = this.items.filter(item => item !== existing);
    }
    this.bus.emit(EVENTS.ITEM_REMOVED, id, quantity);
    return true;
  }

  /** Check if inventory has at least `quantity` of an item. */
  hasItem(id: string, quantity: number = 1): boolean {
    const total = this.getItemCount(id);
    return total >= quantity;
  }

  /** Get total count of an item across all stacks. */
  getItemCount(id: string): number {
    return this.items
      .filter(item => item.id === id)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  /** Get the first matching inventory entry. */
  getItem(id: string): InventoryItem | undefined {
    return this.items.find(item => item.id === id);
  }

  /** Get all inventory items. */
  getAll(): InventoryItem[] {
    return [...this.items];
  }

  /** Filter items by category using ItemRegistry lookups. */
  getByCategory(category: string): InventoryItem[] {
    return this.items.filter(item => {
      const def = ItemRegistry.getItem(item.id);
      return def?.category === category;
    });
  }

  /** Serialize for save. */
  serialize(): InventoryItem[] {
    return this.items.map(item => ({ ...item }));
  }

  /** Load from save data. */
  load(items: InventoryItem[]): void {
    this.items = items.map(item => ({ ...item }));
  }

  /** Get the number of used slots. */
  getUsedSlots(): number {
    return this.items.length;
  }

  /** Check if inventory is full. */
  isFull(): boolean {
    return this.items.length >= INVENTORY_SIZE;
  }
}
