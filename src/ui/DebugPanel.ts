import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI_COLORS, EVENTS, SCALED_TILE, pixelToGrid } from '../utils/Constants';
import { TimeSystem } from '../systems/TimeSystem';
import { FarmingSystem } from '../systems/FarmingSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { ToolSystem } from '../systems/ToolSystem';
import { EventBus } from '../utils/EventBus';
import { ItemRegistry } from '../data/ItemRegistry';

const PANEL_WIDTH = 220;
const PANEL_PAD = 8;
const LINE_HEIGHT = 18;
const BUTTON_HEIGHT = 20;
const BUTTON_GAP = 4;

/**
 * Debug panel for development/QA. Only visible in dev mode.
 * Toggle with F9 key (or backtick `).
 *
 * Features:
 * - Time speed controls (1x, 2x, 5x, 10x, 50x)
 * - Skip to night / dawn
 * - Add/remove energy
 * - Add gold
 * - Add items to inventory
 * - Show grid coordinates and tile info
 * - FPS counter
 */
export class DebugPanel {
  private scene: Phaser.Scene;
  private timeSystem: TimeSystem;
  private farmingSystem: FarmingSystem;
  private inventorySystem: InventorySystem;
  private toolSystem: ToolSystem;
  private bus: EventBus;

  private container!: Phaser.GameObjects.Container;
  private isVisible: boolean = false;

  // Info displays
  private fpsText!: Phaser.GameObjects.Text;
  private coordsText!: Phaser.GameObjects.Text;
  private tileInfoText!: Phaser.GameObjects.Text;
  private timeScaleText!: Phaser.GameObjects.Text;

  // Persistent overlay info (visible even when panel is closed)
  private overlayFpsText!: Phaser.GameObjects.Text;
  private overlayTimeScaleText!: Phaser.GameObjects.Text;
  private overlayBg!: Phaser.GameObjects.Graphics;

  // DOM keydown handler ref (for cleanup)
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    timeSystem: TimeSystem,
    farmingSystem: FarmingSystem,
    inventorySystem: InventorySystem,
    toolSystem: ToolSystem,
  ) {
    this.scene = scene;
    this.timeSystem = timeSystem;
    this.farmingSystem = farmingSystem;
    this.inventorySystem = inventorySystem;
    this.toolSystem = toolSystem;
    this.bus = EventBus.getInstance();

    this.buildOverlay();
    this.buildPanel();

    // Use DOM event listener for reliable key detection on all platforms
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === 'F9') {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  private buildOverlay(): void {
    // Small FPS + time scale indicator in bottom-left corner (always visible in dev)
    this.overlayBg = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(9999);
    this.overlayBg.fillStyle(0x000000, 0.6);
    this.overlayBg.fillRoundedRect(4, GAME_HEIGHT - 30, 200, 24, 3);

    this.overlayFpsText = this.scene.add.text(10, GAME_HEIGHT - 26, 'FPS: --', {
      fontSize: '11px', color: '#00ff00', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(9999);

    this.overlayTimeScaleText = this.scene.add.text(90, GAME_HEIGHT - 26, 'Speed: 1x  [F9] Debug', {
      fontSize: '11px', color: '#ffcc00', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(9999);
  }

  private buildPanel(): void {
    this.container = this.scene.add.container(0, 0)
      .setDepth(9998).setScrollFactor(0).setVisible(false);

    const panelHeight = 340;
    const panelX = GAME_WIDTH - PANEL_WIDTH - 8;
    const panelY = 76;

    // Panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.92);
    bg.fillRoundedRect(panelX, panelY, PANEL_WIDTH, panelHeight, 6);
    bg.lineStyle(2, 0x00ff88, 0.8);
    bg.strokeRoundedRect(panelX, panelY, PANEL_WIDTH, panelHeight, 6);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(panelX + PANEL_WIDTH / 2, panelY + 10, 'DEBUG PANEL', {
      fontSize: '12px', color: '#00ff88', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    const hint = this.scene.add.text(panelX + PANEL_WIDTH - PANEL_PAD, panelY + 10, '[F9] Close', {
      fontSize: '9px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(1, 0);
    this.container.add(hint);

    let curY = panelY + 30;

    // ─── TIME SPEED ───────────────────────────────
    this.addSectionLabel(panelX, curY, 'Time Speed');
    curY += LINE_HEIGHT;

    this.timeScaleText = this.scene.add.text(panelX + PANEL_PAD, curY, 'Current: 1x', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
    });
    this.container.add(this.timeScaleText);
    curY += LINE_HEIGHT;

    const speeds = [1, 2, 5, 10, 50];
    const speedStartX = panelX + PANEL_PAD;
    const speedBtnWidth = (PANEL_WIDTH - PANEL_PAD * 2 - BUTTON_GAP * (speeds.length - 1)) / speeds.length;

    for (let i = 0; i < speeds.length; i++) {
      const bx = speedStartX + i * (speedBtnWidth + BUTTON_GAP);
      this.createButton(bx, curY, speedBtnWidth, BUTTON_HEIGHT, `${speeds[i]}x`, () => {
        this.timeSystem.setTimeScale(speeds[i]);
        this.timeScaleText.setText(`Current: ${speeds[i]}x`);
        this.overlayTimeScaleText.setText(`Speed: ${speeds[i]}x`);
        if (speeds[i] > 1) {
          this.overlayTimeScaleText.setColor('#ff8800');
        } else {
          this.overlayTimeScaleText.setColor('#ffcc00');
        }
      });
    }
    curY += BUTTON_HEIGHT + BUTTON_GAP * 2;

    // ─── DAY CONTROLS ─────────────────────────────
    this.addSectionLabel(panelX, curY, 'Day Controls');
    curY += LINE_HEIGHT;

    const halfWidth = (PANEL_WIDTH - PANEL_PAD * 2 - BUTTON_GAP) / 2;
    this.createButton(panelX + PANEL_PAD, curY, halfWidth, BUTTON_HEIGHT, 'Skip to Night', () => {
      this.timeSystem.setTime(20, 0);
    });
    this.createButton(panelX + PANEL_PAD + halfWidth + BUTTON_GAP, curY, halfWidth, BUTTON_HEIGHT, 'Skip to Dawn', () => {
      this.timeSystem.setTime(6, 0);
    });
    curY += BUTTON_HEIGHT + BUTTON_GAP * 2;

    // ─── ENERGY CONTROLS ──────────────────────────
    this.addSectionLabel(panelX, curY, 'Energy');
    curY += LINE_HEIGHT;

    this.createButton(panelX + PANEL_PAD, curY, halfWidth, BUTTON_HEIGHT, 'Full Energy', () => {
      this.toolSystem.setEnergy(100, 100);
      this.bus.emit(EVENTS.ENERGY_CHANGED, 100, 100);
    });
    this.createButton(panelX + PANEL_PAD + halfWidth + BUTTON_GAP, curY, halfWidth, BUTTON_HEIGHT, 'Drain Energy', () => {
      this.toolSystem.setEnergy(5, 100);
      this.bus.emit(EVENTS.ENERGY_CHANGED, 5, 100);
    });
    curY += BUTTON_HEIGHT + BUTTON_GAP * 2;

    // ─── GOLD ─────────────────────────────────────
    this.addSectionLabel(panelX, curY, 'Gold');
    curY += LINE_HEIGHT;

    this.createButton(panelX + PANEL_PAD, curY, halfWidth, BUTTON_HEIGHT, '+500 Gold', () => {
      this.bus.emit('debug:addGold', 500);
    });
    this.createButton(panelX + PANEL_PAD + halfWidth + BUTTON_GAP, curY, halfWidth, BUTTON_HEIGHT, '+5000 Gold', () => {
      this.bus.emit('debug:addGold', 5000);
    });
    curY += BUTTON_HEIGHT + BUTTON_GAP * 2;

    // ─── ITEMS ────────────────────────────────────
    this.addSectionLabel(panelX, curY, 'Items');
    curY += LINE_HEIGHT;

    this.createButton(panelX + PANEL_PAD, curY, halfWidth, BUTTON_HEIGHT, '+10 Parsnip Seeds', () => {
      this.inventorySystem.addItem('parsnip_seeds', 10);
    });
    this.createButton(panelX + PANEL_PAD + halfWidth + BUTTON_GAP, curY, halfWidth, BUTTON_HEIGHT, '+10 Tomato Seeds', () => {
      this.inventorySystem.addItem('tomato_seeds', 10);
    });
    curY += BUTTON_HEIGHT + BUTTON_GAP;
    this.createButton(panelX + PANEL_PAD, curY, halfWidth, BUTTON_HEIGHT, '+10 Potato Seeds', () => {
      this.inventorySystem.addItem('potato_seeds', 10);
    });
    this.createButton(panelX + PANEL_PAD + halfWidth + BUTTON_GAP, curY, halfWidth, BUTTON_HEIGHT, '+10 Pumpkin Seeds', () => {
      this.inventorySystem.addItem('pumpkin_seeds', 10);
    });
    curY += BUTTON_HEIGHT + BUTTON_GAP * 2;

    // ─── INFO ─────────────────────────────────────
    this.addSectionLabel(panelX, curY, 'Info');
    curY += LINE_HEIGHT;

    this.fpsText = this.scene.add.text(panelX + PANEL_PAD, curY, 'FPS: --', {
      fontSize: '10px', color: '#00ff00', fontFamily: 'monospace',
    });
    this.container.add(this.fpsText);
    curY += LINE_HEIGHT - 4;

    this.coordsText = this.scene.add.text(panelX + PANEL_PAD, curY, 'Grid: (-, -)', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
    });
    this.container.add(this.coordsText);
    curY += LINE_HEIGHT - 4;

    this.tileInfoText = this.scene.add.text(panelX + PANEL_PAD, curY, 'Tile: -', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
      wordWrap: { width: PANEL_WIDTH - PANEL_PAD * 2 },
    });
    this.container.add(this.tileInfoText);
  }

  private addSectionLabel(panelX: number, y: number, label: string): void {
    const text = this.scene.add.text(panelX + PANEL_PAD, y, `── ${label} ──`, {
      fontSize: '10px', color: '#00ff88', fontFamily: 'monospace',
    });
    this.container.add(text);
  }

  private createButton(
    x: number, y: number, width: number, height: number,
    label: string, onClick: () => void,
  ): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x2a2a4e, 1);
    bg.fillRoundedRect(x, y, width, height, 3);
    bg.lineStyle(1, 0x4444aa, 0.8);
    bg.strokeRoundedRect(x, y, width, height, 3);
    this.container.add(bg);

    const text = this.scene.add.text(x + width / 2, y + height / 2, label, {
      fontSize: '9px', color: '#ccccff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(text);

    // Interactive zone
    const zone = this.scene.add.zone(x + width / 2, y + height / 2, width, height)
      .setInteractive().setScrollFactor(0);

    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x4444aa, 1);
      bg.fillRoundedRect(x, y, width, height, 3);
      bg.lineStyle(1, 0x6666dd, 1);
      bg.strokeRoundedRect(x, y, width, height, 3);
      text.setColor('#ffffff');
    });
    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x2a2a4e, 1);
      bg.fillRoundedRect(x, y, width, height, 3);
      bg.lineStyle(1, 0x4444aa, 0.8);
      bg.strokeRoundedRect(x, y, width, height, 3);
      text.setColor('#ccccff');
    });
    zone.on('pointerdown', () => {
      onClick();
    });

    this.container.add(zone);
  }

  toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.setVisible(this.isVisible);
  }

  update(player: Phaser.GameObjects.Sprite): void {
    // Update FPS
    const fps = Math.round(this.scene.game.loop.actualFps);
    const fpsColor = fps >= 55 ? '#00ff00' : fps >= 30 ? '#ffcc00' : '#ff4444';
    this.overlayFpsText.setText(`FPS: ${fps}`);
    this.overlayFpsText.setColor(fpsColor);

    if (!this.isVisible) return;

    this.fpsText.setText(`FPS: ${fps}`);
    this.fpsText.setColor(fpsColor);

    // Player grid position
    const { gx, gy } = pixelToGrid(player.x, player.y);
    this.coordsText.setText(`Grid: (${gx}, ${gy})  Px: (${Math.round(player.x)}, ${Math.round(player.y)})`);

    // Tile info at player's facing direction
    const tile = this.farmingSystem.getTile(gx, gy);
    const blocked = this.farmingSystem.isBlocked(gx, gy);
    const inFarm = this.farmingSystem.isInFarmArea(gx, gy);
    let info = `Farm: ${inFarm ? 'yes' : 'no'}`;
    if (blocked) info += ' | BLOCKED';
    if (tile) {
      info += ` | ${tile.state}`;
      if (tile.cropId) info += ` (${tile.cropId} d${tile.daysGrown ?? 0})`;
      if (tile.isWatered) info += ' [wet]';
    }
    this.tileInfoText.setText(info);
  }

  destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    this.container.destroy();
    this.overlayBg.destroy();
    this.overlayFpsText.destroy();
    this.overlayTimeScaleText.destroy();
  }
}
