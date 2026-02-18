import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventorySystem } from '../../src/systems/InventorySystem';
import { ItemRegistry } from '../../src/data/ItemRegistry';
import { EventBus } from '../../src/utils/EventBus';
import { EVENTS, INVENTORY_SIZE } from '../../src/utils/Constants';
import { ItemDefinition } from '../../src/models/ItemData';

const testItems: ItemDefinition[] = [
  { id: 'parsnip_seeds', name: 'Parsnip Seeds', category: 'seed', stackable: true, maxStack: 99, textureKey: 'icon_seed_parsnip', sellPrice: 10, description: 'Seeds.' },
  { id: 'parsnip', name: 'Parsnip', category: 'crop', stackable: true, maxStack: 99, textureKey: 'icon_crop_parsnip', sellPrice: 35, description: 'A root vegetable.' },
  { id: 'hoe', name: 'Hoe', category: 'tool', toolType: 'Hoe', stackable: false, textureKey: 'icon_hoe', description: 'Tills soil.' },
  { id: 'wood', name: 'Wood', category: 'material', stackable: true, maxStack: 999, textureKey: 'icon_wood', sellPrice: 2, description: 'Lumber.' },
];

describe('InventorySystem', () => {
  let inv: InventorySystem;

  beforeEach(() => {
    EventBus.resetInstance();
    ItemRegistry.reset();
    ItemRegistry.loadItems(testItems);
    inv = new InventorySystem();
  });

  describe('addItem', () => {
    it('should add a stackable item', () => {
      expect(inv.addItem('parsnip_seeds', 5)).toBe(true);
      expect(inv.getItemCount('parsnip_seeds')).toBe(5);
    });

    it('should stack onto existing items', () => {
      inv.addItem('parsnip_seeds', 10);
      inv.addItem('parsnip_seeds', 5);
      expect(inv.getItemCount('parsnip_seeds')).toBe(15);
      expect(inv.getUsedSlots()).toBe(1);
    });

    it('should respect maxStack limit', () => {
      inv.addItem('parsnip_seeds', 99);
      // Adding more should overflow to a new stack if space
      inv.addItem('parsnip_seeds', 10);
      expect(inv.getItemCount('parsnip_seeds')).toBe(109);
      expect(inv.getUsedSlots()).toBe(2);
    });

    it('should add non-stackable items to separate slots', () => {
      inv.addItem('hoe', 1);
      inv.addItem('hoe', 1);
      expect(inv.getUsedSlots()).toBe(2);
    });

    it('should fail when inventory is full', () => {
      // Fill inventory to capacity
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        inv.addItem('hoe', 1);
      }
      expect(inv.isFull()).toBe(true);
      expect(inv.addItem('hoe', 1)).toBe(false);
    });

    it('should reject adding zero or negative quantities', () => {
      expect(inv.addItem('parsnip_seeds', 0)).toBe(false);
      expect(inv.addItem('parsnip_seeds', -1)).toBe(false);
    });

    it('should emit ITEM_ADDED event', () => {
      const bus = EventBus.getInstance();
      const handler = vi.fn();
      bus.on(EVENTS.ITEM_ADDED, handler);

      inv.addItem('parsnip_seeds', 5);
      expect(handler).toHaveBeenCalledWith('parsnip_seeds', 5);
    });
  });

  describe('removeItem', () => {
    it('should remove items from a stack', () => {
      inv.addItem('parsnip_seeds', 10);
      expect(inv.removeItem('parsnip_seeds', 3)).toBe(true);
      expect(inv.getItemCount('parsnip_seeds')).toBe(7);
    });

    it('should remove the slot when quantity reaches zero', () => {
      inv.addItem('parsnip_seeds', 5);
      inv.removeItem('parsnip_seeds', 5);
      expect(inv.getItemCount('parsnip_seeds')).toBe(0);
      expect(inv.getUsedSlots()).toBe(0);
    });

    it('should fail if item does not exist', () => {
      expect(inv.removeItem('nonexistent')).toBe(false);
    });

    it('should fail if quantity exceeds available', () => {
      inv.addItem('parsnip_seeds', 3);
      expect(inv.removeItem('parsnip_seeds', 5)).toBe(false);
      expect(inv.getItemCount('parsnip_seeds')).toBe(3); // Unchanged
    });

    it('should emit ITEM_REMOVED event', () => {
      const bus = EventBus.getInstance();
      const handler = vi.fn();
      bus.on(EVENTS.ITEM_REMOVED, handler);

      inv.addItem('parsnip_seeds', 10);
      inv.removeItem('parsnip_seeds', 3);
      expect(handler).toHaveBeenCalledWith('parsnip_seeds', 3);
    });
  });

  describe('hasItem', () => {
    it('should return true when enough items exist', () => {
      inv.addItem('parsnip_seeds', 10);
      expect(inv.hasItem('parsnip_seeds', 5)).toBe(true);
      expect(inv.hasItem('parsnip_seeds', 10)).toBe(true);
    });

    it('should return false when not enough items', () => {
      inv.addItem('parsnip_seeds', 3);
      expect(inv.hasItem('parsnip_seeds', 5)).toBe(false);
    });

    it('should return false for items not in inventory', () => {
      expect(inv.hasItem('nonexistent')).toBe(false);
    });
  });

  describe('getByCategory', () => {
    it('should filter items by category', () => {
      inv.addItem('parsnip_seeds', 5);
      inv.addItem('parsnip', 3);
      inv.addItem('hoe', 1);
      inv.addItem('wood', 10);

      const seeds = inv.getByCategory('seed');
      expect(seeds).toHaveLength(1);
      expect(seeds[0].id).toBe('parsnip_seeds');

      const tools = inv.getByCategory('tool');
      expect(tools).toHaveLength(1);

      const materials = inv.getByCategory('material');
      expect(materials).toHaveLength(1);
    });
  });

  describe('serialization', () => {
    it('should serialize and restore inventory', () => {
      inv.addItem('parsnip_seeds', 15);
      inv.addItem('hoe', 1);
      inv.addItem('wood', 50);

      const saved = inv.serialize();
      expect(saved).toHaveLength(3);

      // Create a new inventory from the serialized data
      const inv2 = new InventorySystem(saved);
      expect(inv2.getItemCount('parsnip_seeds')).toBe(15);
      expect(inv2.hasItem('hoe')).toBe(true);
      expect(inv2.getItemCount('wood')).toBe(50);
    });

    it('should deep copy on serialize (no shared references)', () => {
      inv.addItem('parsnip_seeds', 10);
      const saved = inv.serialize();
      inv.addItem('parsnip_seeds', 5);

      // Saved data should not be affected by later changes
      expect(saved[0].quantity).toBe(10);
      expect(inv.getItemCount('parsnip_seeds')).toBe(15);
    });
  });

  describe('getAll', () => {
    it('should return a copy of all items', () => {
      inv.addItem('parsnip_seeds', 5);
      inv.addItem('hoe', 1);
      const all = inv.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('isFull / getUsedSlots', () => {
    it('should track used slots correctly', () => {
      expect(inv.getUsedSlots()).toBe(0);
      expect(inv.isFull()).toBe(false);

      inv.addItem('parsnip_seeds', 5);
      expect(inv.getUsedSlots()).toBe(1);
    });
  });
});
