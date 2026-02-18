import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SLOTS, UI_COLORS, EVENTS, SCALE } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';
import { ItemRegistry } from '../data/ItemRegistry';

interface HotbarSlot {
  itemId: string | null;
  background: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image | null;
  keyLabel: Phaser.GameObjects.Text;
}

/** Fallback map for items that may not be in the registry yet (tools). */
const ICON_FALLBACK: Record<string, string> = {
  hoe: 'icon_hoe',
  watering_can: 'icon_watering_can',
  axe: 'icon_axe',
  shovel: 'icon_shovel',
  fishing_rod: 'icon_fishing_rod',
  pickaxe: 'icon_pickaxe',
};

export class Hotbar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private slots: HotbarSlot[] = [];
  private selectedIndex: number = 0;
  private bus: EventBus;

  // Sizing
  private readonly slotSize = 40;
  private readonly slotGap = 4;
  private readonly totalWidth: number;
  private readonly barHeight = 48;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bus = EventBus.getInstance();
    this.totalWidth = HOTBAR_SLOTS * (this.slotSize + this.slotGap) - this.slotGap + 16;

    const barX = (GAME_WIDTH - this.totalWidth) / 2;
    const barY = GAME_HEIGHT - this.barHeight - 8;

    this.container = scene.add.container(barX, barY).setDepth(5300).setScrollFactor(0);

    // Background panel
    const bg = scene.add.graphics();
    bg.fillStyle(UI_COLORS.hotbarBg, 0.85);
    bg.fillRoundedRect(0, 0, this.totalWidth, this.barHeight, 6);
    bg.lineStyle(2, UI_COLORS.panelBorder, 0.8);
    bg.strokeRoundedRect(0, 0, this.totalWidth, this.barHeight, 6);
    this.container.add(bg);

    // Create slots
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const x = 8 + i * (this.slotSize + this.slotGap);
      const y = 4;

      const slotBg = scene.add.graphics();
      this.drawSlot(slotBg, x, y, i === this.selectedIndex);
      this.container.add(slotBg);

      // Key number label
      const keyLabel = scene.add.text(x + 2, y + 1, `${i + 1}`, {
        fontSize: '9px',
        color: '#888888',
        fontFamily: 'monospace',
      });
      this.container.add(keyLabel);

      this.slots.push({
        itemId: null,
        background: slotBg,
        icon: null,
        keyLabel,
      });
    }

    // Setup keyboard input (1-9)
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const key = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i);
      const index = i;
      key.on('down', () => this.selectSlot(index));
    }

    // Listen for hotbar updates
    this.bus.on(EVENTS.HOTBAR_UPDATED, (items: (string | null)[]) => {
      this.setItems(items);
    });
  }

  private drawSlot(graphics: Phaser.GameObjects.Graphics, x: number, y: number, selected: boolean): void {
    graphics.clear();
    graphics.fillStyle(UI_COLORS.hotbarSlot, 0.9);
    graphics.fillRoundedRect(x, y, this.slotSize, this.slotSize, 3);

    if (selected) {
      graphics.lineStyle(2, UI_COLORS.hotbarSelected, 1);
    } else {
      graphics.lineStyle(1, UI_COLORS.panelBorder, 0.5);
    }
    graphics.strokeRoundedRect(x, y, this.slotSize, this.slotSize, 3);
  }

  selectSlot(index: number): void {
    if (index < 0 || index >= HOTBAR_SLOTS) return;

    const prevIndex = this.selectedIndex;
    this.selectedIndex = index;

    // Redraw previous and new slot
    const prevX = 8 + prevIndex * (this.slotSize + this.slotGap);
    const newX = 8 + index * (this.slotSize + this.slotGap);
    this.drawSlot(this.slots[prevIndex].background, prevX, 4, false);
    this.drawSlot(this.slots[index].background, newX, 4, true);

    this.bus.emit(EVENTS.HOTBAR_SELECT, index, this.slots[index].itemId);
  }

  setItems(items: (string | null)[]): void {
    for (let i = 0; i < HOTBAR_SLOTS && i < items.length; i++) {
      this.setSlotItem(i, items[i]);
    }
  }

  setSlotItem(index: number, itemId: string | null): void {
    const slot = this.slots[index];
    slot.itemId = itemId;

    // Remove old icon
    if (slot.icon) {
      slot.icon.destroy();
      slot.icon = null;
    }

    // Add new icon if item exists
    if (itemId) {
      // Dynamic lookup: try ItemRegistry first, then fallback map, then raw ID
      const itemDef = ItemRegistry.getItem(itemId);
      const textureKey = itemDef?.textureKey ?? ICON_FALLBACK[itemId] ?? itemId;
      const x = 8 + index * (this.slotSize + this.slotGap) + this.slotSize / 2;
      const y = 4 + this.slotSize / 2;

      if (this.scene.textures.exists(textureKey)) {
        const icon = this.scene.add.image(x, y, textureKey);
        icon.setScale(2);
        this.container.add(icon);
        slot.icon = icon;
      }
    }
  }

  getSelectedItem(): string | null {
    return this.slots[this.selectedIndex]?.itemId ?? null;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /** Get all hotbar item IDs (for saving). */
  getItems(): (string | null)[] {
    return this.slots.map(s => s.itemId);
  }

  /**
   * Returns the hotbar slot index at the given screen coordinates, or -1 if none.
   * Used by drag-and-drop from inventory.
   */
  getSlotAtPoint(screenX: number, screenY: number): number {
    const barX = (GAME_WIDTH - this.totalWidth) / 2;
    const barY = GAME_HEIGHT - this.barHeight - 8;

    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slotX = barX + 8 + i * (this.slotSize + this.slotGap);
      const slotY = barY + 4;

      if (screenX >= slotX && screenX <= slotX + this.slotSize &&
          screenY >= slotY && screenY <= slotY + this.slotSize) {
        return i;
      }
    }
    return -1;
  }

  destroy(): void {
    this.container.destroy();
  }
}
