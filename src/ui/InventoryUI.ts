import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, INVENTORY_SIZE, UI_COLORS, EVENTS, HOTBAR_SLOTS } from '../utils/Constants';
import { InventorySystem } from '../systems/InventorySystem';
import { ItemRegistry } from '../data/ItemRegistry';
import { EventBus } from '../utils/EventBus';
import { InventoryItem } from '../models/SaveData';
import { Hotbar } from './Hotbar';

const COLS = 9;
const ROWS = 3;
const SLOT_SIZE = 44;
const SLOT_GAP = 4;
const PANEL_PAD = 12;
const ICON_SCALE = 2;

/**
 * Grid-based inventory overlay UI.
 * Shows 27 item slots (3 rows x 9 columns) with item icons, quantities,
 * and a tooltip on hover. Supports drag-and-drop to the hotbar.
 * Toggled with the I key.
 */
export class InventoryUI {
  private scene: Phaser.Scene;
  private inventorySystem: InventorySystem;
  private hotbar: Hotbar | null = null;
  private bus: EventBus;
  private isVisible: boolean = false;

  private container!: Phaser.GameObjects.Container;

  // Slot UI elements
  private slotBackgrounds: Phaser.GameObjects.Graphics[] = [];
  private slotIcons: (Phaser.GameObjects.Image | null)[] = [];
  private slotQuantities: Phaser.GameObjects.Text[] = [];

  // Tooltip
  private tooltip!: Phaser.GameObjects.Container;
  private tooltipBg!: Phaser.GameObjects.Graphics;
  private tooltipName!: Phaser.GameObjects.Text;
  private tooltipDesc!: Phaser.GameObjects.Text;

  // Selection
  private selectedIndex: number = -1;
  private selectedHighlight!: Phaser.GameObjects.Graphics;

  // Drag state
  private isDragging: boolean = false;
  private dragItemId: string | null = null;
  private dragGhost: Phaser.GameObjects.Image | null = null;
  private dragStartIndex: number = -1;

  // Panel dimensions (computed)
  private panelWidth: number;
  private panelHeight: number;
  private panelX: number;
  private panelY: number;

  constructor(scene: Phaser.Scene, inventorySystem: InventorySystem) {
    this.scene = scene;
    this.inventorySystem = inventorySystem;
    this.bus = EventBus.getInstance();

    this.panelWidth = COLS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP + PANEL_PAD * 2;
    this.panelHeight = ROWS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP + PANEL_PAD * 2 + 30; // +30 for title
    this.panelX = (GAME_WIDTH - this.panelWidth) / 2;
    this.panelY = (GAME_HEIGHT - this.panelHeight) / 2;

    this.buildUI();
    this.container.setVisible(false);

    // Listen for inventory changes to refresh while open
    this.bus.on(EVENTS.ITEM_ADDED, () => { if (this.isVisible) this.refreshSlots(); });
    this.bus.on(EVENTS.ITEM_REMOVED, () => { if (this.isVisible) this.refreshSlots(); });

    // Drag move/release handlers (scene-wide)
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging && this.dragGhost) {
        this.dragGhost.setPosition(pointer.x, pointer.y);
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.onDragEnd(pointer.x, pointer.y);
      }
    });
  }

  /** Set the hotbar reference for drag-and-drop targeting. */
  setHotbar(hotbar: Hotbar): void {
    this.hotbar = hotbar;
  }

  private buildUI(): void {
    this.container = this.scene.add.container(0, 0).setDepth(5600).setScrollFactor(0);

    // Dim background overlay — only covers the top part, leaving hotbar visible
    const dimOverlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.4
    );
    this.container.add(dimOverlay);

    // Panel background
    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(UI_COLORS.panelBg, 0.95);
    panelBg.fillRoundedRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight, 8);
    panelBg.lineStyle(2, UI_COLORS.panelBorder, 1);
    panelBg.strokeRoundedRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight, 8);
    this.container.add(panelBg);

    // Title
    const title = this.scene.add.text(GAME_WIDTH / 2, this.panelY + 14, 'Inventory', {
      fontSize: '14px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Close hint and drag hint
    const closeHint = this.scene.add.text(
      this.panelX + this.panelWidth - PANEL_PAD, this.panelY + 14,
      '[I] Close', {
        fontSize: '10px',
        color: UI_COLORS.textSecondary,
        fontFamily: 'monospace',
      }
    ).setOrigin(1, 0);
    this.container.add(closeHint);

    const dragHint = this.scene.add.text(
      this.panelX + PANEL_PAD, this.panelY + 14,
      'Drag to hotbar', {
        fontSize: '10px',
        color: UI_COLORS.textSecondary,
        fontFamily: 'monospace',
      }
    ).setOrigin(0, 0);
    this.container.add(dragHint);

    // Selection highlight (drawn behind icons)
    this.selectedHighlight = this.scene.add.graphics();
    this.container.add(this.selectedHighlight);

    // Create slot grid
    const gridStartX = this.panelX + PANEL_PAD;
    const gridStartY = this.panelY + 34;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        const x = gridStartX + col * (SLOT_SIZE + SLOT_GAP);
        const y = gridStartY + row * (SLOT_SIZE + SLOT_GAP);

        // Slot background
        const slotBg = this.scene.add.graphics();
        slotBg.fillStyle(UI_COLORS.hotbarSlot, 0.9);
        slotBg.fillRoundedRect(x, y, SLOT_SIZE, SLOT_SIZE, 3);
        slotBg.lineStyle(1, UI_COLORS.panelBorder, 0.5);
        slotBg.strokeRoundedRect(x, y, SLOT_SIZE, SLOT_SIZE, 3);
        this.container.add(slotBg);
        this.slotBackgrounds.push(slotBg);

        // Placeholder for icon (will be created in refreshSlots)
        this.slotIcons.push(null);

        // Quantity label (bottom-right of slot)
        const qtyText = this.scene.add.text(x + SLOT_SIZE - 3, y + SLOT_SIZE - 3, '', {
          fontSize: '9px',
          color: '#ffffff',
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(1, 1);
        this.container.add(qtyText);
        this.slotQuantities.push(qtyText);

        // Interactive zone for hover/click/drag
        const zone = this.scene.add.zone(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
          .setInteractive()
          .setScrollFactor(0);
        zone.setData('slotIndex', idx);

        zone.on('pointerover', () => this.onSlotHover(idx));
        zone.on('pointerout', () => this.onSlotHoverEnd());
        zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onSlotPointerDown(idx, pointer));

        this.container.add(zone);
      }
    }

    // Build tooltip (hidden by default)
    this.buildTooltip();
  }

  private buildTooltip(): void {
    this.tooltip = this.scene.add.container(0, 0).setDepth(5700).setScrollFactor(0).setVisible(false);

    this.tooltipBg = this.scene.add.graphics();
    this.tooltip.add(this.tooltipBg);

    this.tooltipName = this.scene.add.text(8, 6, '', {
      fontSize: '12px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.tooltip.add(this.tooltipName);

    this.tooltipDesc = this.scene.add.text(8, 22, '', {
      fontSize: '10px',
      color: UI_COLORS.textSecondary,
      fontFamily: 'monospace',
      wordWrap: { width: 180 },
    });
    this.tooltip.add(this.tooltipDesc);
  }

  private refreshSlots(): void {
    const items = this.inventorySystem.getAll();

    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const item: InventoryItem | undefined = items[i];

      // Destroy old icon
      if (this.slotIcons[i]) {
        this.slotIcons[i]!.destroy();
        this.slotIcons[i] = null;
      }

      if (item) {
        // Look up item definition for texture
        const itemDef = ItemRegistry.getItem(item.id);
        const textureKey = itemDef?.textureKey ?? item.id;

        // Compute slot position
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const gridStartX = this.panelX + PANEL_PAD;
        const gridStartY = this.panelY + 34;
        const x = gridStartX + col * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;
        const y = gridStartY + row * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2;

        if (this.scene.textures.exists(textureKey)) {
          const icon = this.scene.add.image(x, y, textureKey).setScale(ICON_SCALE);
          this.container.add(icon);
          this.slotIcons[i] = icon;
        }

        // Quantity text
        this.slotQuantities[i].setText(item.quantity > 1 ? `${item.quantity}` : '');
        this.slotQuantities[i].setVisible(true);
      } else {
        this.slotQuantities[i].setText('');
        this.slotQuantities[i].setVisible(false);
      }
    }
  }

  private onSlotHover(index: number): void {
    if (!this.isVisible || this.isDragging) return;
    const items = this.inventorySystem.getAll();
    const item = items[index];
    if (!item) {
      this.tooltip.setVisible(false);
      return;
    }

    const itemDef = ItemRegistry.getItem(item.id);
    const name = itemDef?.name ?? item.id;
    const desc = itemDef?.description ?? '';
    const sellInfo = itemDef?.sellPrice ? `\nSell: ${itemDef.sellPrice}G` : '';

    this.tooltipName.setText(name);
    this.tooltipDesc.setText(desc + sellInfo);

    // Size the tooltip background
    const width = 200;
    const textHeight = this.tooltipDesc.height + 30;
    const height = Math.max(40, textHeight);

    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(0x1a1008, 0.95);
    this.tooltipBg.fillRoundedRect(0, 0, width, height, 4);
    this.tooltipBg.lineStyle(1, UI_COLORS.panelBorder, 0.8);
    this.tooltipBg.strokeRoundedRect(0, 0, width, height, 4);

    // Position tooltip near the slot
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const gridStartX = this.panelX + PANEL_PAD;
    const gridStartY = this.panelY + 34;
    let tooltipX = gridStartX + col * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE + 4;
    const tooltipY = gridStartY + row * (SLOT_SIZE + SLOT_GAP);

    // Keep tooltip on screen
    if (tooltipX + width > GAME_WIDTH - 8) {
      tooltipX = gridStartX + col * (SLOT_SIZE + SLOT_GAP) - width - 4;
    }

    this.tooltip.setPosition(tooltipX, tooltipY);
    this.tooltip.setVisible(true);
  }

  private onSlotHoverEnd(): void {
    if (!this.isDragging) {
      this.tooltip.setVisible(false);
    }
  }

  // ─── DRAG AND DROP ───────────────────────────────────

  private onSlotPointerDown(index: number, pointer: Phaser.Input.Pointer): void {
    if (!this.isVisible) return;
    const items = this.inventorySystem.getAll();
    const item = items[index];
    if (!item) {
      this.selectedIndex = -1;
      this.selectedHighlight.clear();
      return;
    }

    // Start drag
    this.isDragging = true;
    this.dragStartIndex = index;
    this.dragItemId = item.id;
    this.tooltip.setVisible(false);

    // Highlight the source slot
    this.selectedIndex = index;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const gridStartX = this.panelX + PANEL_PAD;
    const gridStartY = this.panelY + 34;
    const x = gridStartX + col * (SLOT_SIZE + SLOT_GAP);
    const y = gridStartY + row * (SLOT_SIZE + SLOT_GAP);

    this.selectedHighlight.clear();
    this.selectedHighlight.lineStyle(2, UI_COLORS.hotbarSelected, 1);
    this.selectedHighlight.strokeRoundedRect(x - 1, y - 1, SLOT_SIZE + 2, SLOT_SIZE + 2, 3);

    // Create ghost icon following cursor
    const itemDef = ItemRegistry.getItem(item.id);
    const textureKey = itemDef?.textureKey ?? item.id;
    if (this.scene.textures.exists(textureKey)) {
      this.dragGhost = this.scene.add.image(pointer.x, pointer.y, textureKey)
        .setScale(ICON_SCALE)
        .setAlpha(0.7)
        .setDepth(5800)
        .setScrollFactor(0);
    }
  }

  private onDragEnd(screenX: number, screenY: number): void {
    this.isDragging = false;

    // Clean up ghost
    if (this.dragGhost) {
      this.dragGhost.destroy();
      this.dragGhost = null;
    }

    if (!this.dragItemId || !this.hotbar) {
      this.dragItemId = null;
      this.dragStartIndex = -1;
      return;
    }

    // Check if dropped on a hotbar slot
    const hotbarSlot = this.hotbar.getSlotAtPoint(screenX, screenY);
    if (hotbarSlot >= 0) {
      // Assign item to hotbar slot
      this.hotbar.setSlotItem(hotbarSlot, this.dragItemId);

      // Emit an event so WorldScene can update saveData
      this.bus.emit(EVENTS.HOTBAR_UPDATED, this.hotbar.getItems());
    }

    this.dragItemId = null;
    this.dragStartIndex = -1;
    this.selectedHighlight.clear();
    this.selectedIndex = -1;
  }

  // ─── PUBLIC API ────────────────────────────────────────

  show(): void {
    this.isVisible = true;
    this.selectedIndex = -1;
    this.selectedHighlight.clear();
    this.refreshSlots();
    this.container.setVisible(true);
    this.bus.emit(EVENTS.INVENTORY_OPEN);
  }

  hide(): void {
    this.isVisible = false;
    this.isDragging = false;
    if (this.dragGhost) {
      this.dragGhost.destroy();
      this.dragGhost = null;
    }
    this.dragItemId = null;
    this.dragStartIndex = -1;
    this.tooltip.setVisible(false);
    this.container.setVisible(false);
    this.selectedHighlight.clear();
    this.bus.emit(EVENTS.INVENTORY_CLOSE);
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  destroy(): void {
    this.container.destroy();
    this.tooltip.destroy();
    if (this.dragGhost) {
      this.dragGhost.destroy();
    }
  }
}
