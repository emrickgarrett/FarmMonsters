import Phaser from 'phaser';
import {
  SCENES, TILE_SIZE, SCALE, SCALED_TILE, GAME_WIDTH, GAME_HEIGHT,
  FARM_WIDTH, FARM_HEIGHT, FARM_AREA, EVENTS, UI_COLORS,
  pixelToGrid, gridToPixel,
} from '../utils/Constants';
import { EventBus } from '../utils/EventBus';
import { Player } from '../entities/Player';
import { TimeSystem } from '../systems/TimeSystem';
import { InteractionSystem } from '../systems/InteractionSystem';
import { FarmingSystem } from '../systems/FarmingSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { ToolSystem } from '../systems/ToolSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { SaveData, FarmTile } from '../models/SaveData';
import { ItemRegistry } from '../data/ItemRegistry';
import { DialogBox } from '../ui/DialogBox';
import { Hotbar } from '../ui/Hotbar';
import { InventoryUI } from '../ui/InventoryUI';
import { DebugPanel } from '../ui/DebugPanel';

/** Depth constants: ground is always behind world objects; UI is always on top. */
const DEPTH = {
  GROUND: 0,
  GROUND_OVERLAY: 1,
  DAY_NIGHT: 5000,
  HUD_BG: 5100,
  HUD_TEXT: 5200,
  HOTBAR: 5300,
  DIALOG: 5400,
  NOTIFICATION: 5500,
  OVERLAY_UI: 5600,
};

interface FarmTileVisual {
  tileSprite: Phaser.GameObjects.Image;
  cropSprite?: Phaser.GameObjects.Image;
}

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private timeSystem!: TimeSystem;
  private interactionSystem!: InteractionSystem;
  private farmingSystem!: FarmingSystem;
  private inventorySystem!: InventorySystem;
  private toolSystem!: ToolSystem;
  private dialogBox!: DialogBox;
  private hotbar!: Hotbar;
  private inventoryUI!: InventoryUI;
  private debugPanel: DebugPanel | null = null;
  private bus!: EventBus;
  private saveData!: SaveData;

  private colliders: Phaser.Physics.Arcade.StaticGroup | null = null;
  private depthSortedSprites: Phaser.GameObjects.Image[] = [];
  private farmTileVisuals: Map<string, FarmTileVisual> = new Map();

  private dayNightOverlay!: Phaser.GameObjects.Rectangle;
  private timeText!: Phaser.GameObjects.Text;
  private dateText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private energyBar!: Phaser.GameObjects.Graphics;
  private interactionPrompt!: Phaser.GameObjects.Text;

  private currentSlot: number = 0;

  constructor() {
    super({ key: SCENES.WORLD });
  }

  create(): void {
    this.bus = EventBus.getInstance();
    this.saveData = this.registry.get('currentSave') as SaveData;
    this.currentSlot = this.registry.get('currentSlot') as number ?? 0;

    // Initialize systems
    this.timeSystem = new TimeSystem({
      hour: this.saveData.time.hour,
      minute: this.saveData.time.minute,
      day: this.saveData.time.day,
      season: this.saveData.time.season,
      year: this.saveData.time.year,
    });
    this.interactionSystem = new InteractionSystem();
    this.farmingSystem = new FarmingSystem(this.saveData.farmTiles);
    this.inventorySystem = new InventorySystem(this.saveData.inventory);
    this.toolSystem = new ToolSystem(this.farmingSystem, this.inventorySystem);
    this.toolSystem.setEnergy(this.saveData.player.energy, this.saveData.player.maxEnergy);

    // Build the farm map
    this.buildFarmMap();
    this.buildFarmTileOverlays();

    // Create player
    this.player = new Player(
      this,
      this.saveData.player.position.x,
      this.saveData.player.position.y
    );
    this.depthSortedSprites.push(this.player);

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    const worldWidth = FARM_WIDTH * SCALED_TILE;
    const worldHeight = FARM_HEIGHT * SCALED_TILE;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Day/night overlay
    this.dayNightOverlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH * 2, GAME_HEIGHT * 2,
      0x000000, 0
    ).setScrollFactor(0).setDepth(DEPTH.DAY_NIGHT).setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.createHUD();

    this.hotbar = new Hotbar(this);
    this.hotbar.setItems(this.saveData.player.hotbar);

    this.dialogBox = new DialogBox(this);
    this.inventoryUI = new InventoryUI(this, this.inventorySystem);
    this.inventoryUI.setHotbar(this.hotbar);

    this.setupEvents();

    this.input.keyboard!.on('keydown-ESC', () => this.openPauseMenu());
    this.input.keyboard!.on('keydown-I', () => this.toggleInventory());

    // Debug panel (dev mode only)
    if (import.meta.env.DEV) {
      this.debugPanel = new DebugPanel(
        this, this.timeSystem, this.farmingSystem,
        this.inventorySystem, this.toolSystem,
      );
    }
  }

  // ─── MAP BUILDING ───────────────────────────────────────

  private buildFarmMap(): void {
    this.colliders = this.physics.add.staticGroup();

    for (let y = 0; y < FARM_HEIGHT; y++) {
      for (let x = 0; x < FARM_WIDTH; x++) {
        const px = x * SCALED_TILE + SCALED_TILE / 2;
        const py = y * SCALED_TILE + SCALED_TILE / 2;

        let tileKey = 'tile_grass';
        if (x >= 8 && x < 24 && y >= 8 && y < 22) tileKey = 'tile_dirt';
        if ((x === 7 && y >= 8 && y < 22) || (y === 7 && x >= 7 && x < 25)) tileKey = 'tile_path';
        if (y >= 14 && y <= 16 && x >= 24 && x < FARM_WIDTH) tileKey = 'tile_path';
        if (x >= 28 && x < 33 && y >= 6 && y < 10) tileKey = 'tile_water';
        if (x === 0 || y === 0 || x === FARM_WIDTH - 1 || y === FARM_HEIGHT - 1) tileKey = 'tile_fence';

        this.add.image(px, py, tileKey).setScale(SCALE).setDepth(DEPTH.GROUND);

        if (tileKey === 'tile_water' || tileKey === 'tile_fence') {
          const collider = this.physics.add.staticImage(px, py, tileKey)
            .setScale(SCALE).setVisible(false);
          collider.body!.setSize(SCALED_TILE, SCALED_TILE);
          this.colliders!.add(collider);
        }
      }
    }

    // House
    const houseX = 12 * SCALED_TILE;
    const houseY = 5 * SCALED_TILE;
    const house = this.add.image(houseX, houseY, 'house').setScale(SCALE).setOrigin(0.5, 1);
    this.depthSortedSprites.push(house);

    const houseColliderWidth = TILE_SIZE * 3 * SCALE;
    const houseColliderHeight = SCALED_TILE;
    const houseZone = this.add.zone(houseX, houseY - houseColliderHeight / 2, houseColliderWidth, houseColliderHeight);
    this.physics.add.existing(houseZone, true);
    this.colliders!.add(houseZone as any);

    this.placeInteractables();
    this.placeTrees();
  }

  private placeInteractables(): void {
    this.placeObject('sign', 7 * SCALED_TILE, 14 * SCALED_TILE, {
      id: 'farm_sign', type: 'sign' as const,
      data: { text: 'Welcome to your farm!\nPress E or SPACE to interact.\nUse 1-9 for hotbar tools.\nPress I for inventory.' },
    });
    this.placeObject('mailbox', 14 * SCALED_TILE, 7 * SCALED_TILE, {
      id: 'mailbox', type: 'mailbox' as const,
      data: { mail: 'Dear Farmer,\nWelcome to your new life in FarmMonsters valley!\nTend your crops, catch monsters, and make friends!\n- The Mayor' },
    });
    this.placeObject('shipping_bin', 10 * SCALED_TILE, 7 * SCALED_TILE, {
      id: 'shipping_bin', type: 'shipping_bin' as const, data: {},
    });
    this.interactionSystem.register({
      id: 'house_door', x: 12 * SCALED_TILE, y: 7 * SCALED_TILE,
      type: 'door', data: { destination: 'house_interior' },
    });
    this.interactionSystem.register({
      id: 'bed', x: 11 * SCALED_TILE, y: 6 * SCALED_TILE,
      type: 'bed', data: {},
    });
    this.placeObject('chest', 16 * SCALED_TILE, 7 * SCALED_TILE, {
      id: 'storage_chest_1', type: 'chest' as const, data: { items: [] },
    });
    this.placeObject('sign', 38 * SCALED_TILE, 15 * SCALED_TILE, {
      id: 'town_sign', type: 'sign' as const,
      data: { text: 'Town Center - Coming Soon!\nThe path continues east toward town...' },
    });
    this.placeObject('sign', 27 * SCALED_TILE, 6 * SCALED_TILE, {
      id: 'pond_sign', type: 'sign' as const,
      data: { text: 'Farm Pond\nTry fishing here!\n(Fishing coming in a future update)' },
    });
  }

  private placeObject(
    textureKey: string, x: number, y: number,
    interactConfig: { id: string; type: any; data: Record<string, any> }
  ): Phaser.GameObjects.Image {
    const obj = this.add.image(x, y, textureKey).setScale(SCALE).setOrigin(0.5, 1);
    this.depthSortedSprites.push(obj);
    const zone = this.add.zone(x, y - SCALED_TILE / 2, SCALED_TILE, SCALED_TILE);
    this.physics.add.existing(zone, true);
    this.colliders!.add(zone as any);
    this.interactionSystem.register({
      id: interactConfig.id, x, y: y - SCALED_TILE / 2,
      type: interactConfig.type, data: interactConfig.data,
    });
    return obj;
  }

  private placeTrees(): void {
    const treePositions = [
      [3, 3], [5, 4], [2, 10], [4, 18], [3, 24],
      [30, 3], [35, 4], [32, 12], [34, 20], [36, 25],
      [25, 3], [27, 4], [26, 22], [28, 24],
      [6, 26], [10, 27], [15, 26], [20, 27], [25, 26],
    ];
    for (const [tx, ty] of treePositions) {
      const x = tx * SCALED_TILE;
      const y = ty * SCALED_TILE;
      const tree = this.add.image(x, y, 'tree').setScale(SCALE).setOrigin(0.5, 1);
      this.depthSortedSprites.push(tree);
      const trunkSize = SCALED_TILE * 0.5;
      const trunkZone = this.add.zone(x, y - trunkSize / 2, trunkSize, trunkSize);
      this.physics.add.existing(trunkZone, true);
      this.colliders!.add(trunkZone as any);
    }
    for (const [sx, sy] of [[15, 10], [18, 14], [22, 11]]) {
      this.placeObject('stump', sx * SCALED_TILE, sy * SCALED_TILE, {
        id: `stump_${sx}_${sy}`, type: 'stump' as const,
        data: { text: 'A tree stump. Use an axe to remove it.' },
      });
      // Block all tiles covered by the collision zone (sprite origin is bottom-center,
      // collision zone is shifted up by half a tile, so it spans a 2x2 area)
      this.blockObstacleTiles(sx, sy);
    }
    for (const [rx, ry] of [[12, 12], [20, 9], [16, 18]]) {
      this.placeObject('rock', rx * SCALED_TILE, ry * SCALED_TILE, {
        id: `rock_${rx}_${ry}`, type: 'rock' as const,
        data: { text: 'A big rock. Use a pickaxe to break it.' },
      });
      this.blockObstacleTiles(rx, ry);
    }
  }

  /**
   * Block all farm tiles covered by an obstacle's collision zone.
   * placeObject() sets origin(0.5, 1) and creates a collision zone at
   * (x, y - SCALED_TILE/2) with size SCALED_TILE x SCALED_TILE, which
   * means the collision spans from grid tile (gx-1, gy-1) to (gx, gy).
   * We block the full 2x2 footprint so no tile under the obstacle can be tilled.
   */
  private blockObstacleTiles(gx: number, gy: number): void {
    for (let dx = -1; dx <= 0; dx++) {
      for (let dy = -1; dy <= 0; dy++) {
        this.farmingSystem.blockTile(gx + dx, gy + dy);
      }
    }
  }

  // ─── FARM TILE VISUALS ──────────────────────────────────

  private buildFarmTileOverlays(): void {
    for (const tile of this.farmingSystem.getAllTiles()) {
      this.updateFarmTileVisual(tile.x, tile.y, tile);
    }
  }

  private updateFarmTileVisual(gx: number, gy: number, tile: FarmTile): void {
    const key = `${gx},${gy}`;
    const { px, py } = gridToPixel(gx, gy);
    let visual = this.farmTileVisuals.get(key);

    if (tile.state === 'untilled') {
      if (visual) {
        visual.tileSprite.destroy();
        if (visual.cropSprite) {
          const idx = this.depthSortedSprites.indexOf(visual.cropSprite);
          if (idx >= 0) this.depthSortedSprites.splice(idx, 1);
          visual.cropSprite.destroy();
        }
        this.farmTileVisuals.delete(key);
      }
      return;
    }

    const tileTexture = tile.isWatered ? 'tile_watered' : 'tile_tilled';

    if (!visual) {
      const tileSprite = this.add.image(px, py, tileTexture)
        .setScale(SCALE).setDepth(DEPTH.GROUND_OVERLAY);
      visual = { tileSprite };
      this.farmTileVisuals.set(key, visual);
    } else {
      visual.tileSprite.setTexture(tileTexture);
    }

    // Crop sprite
    if (tile.state === 'withered') {
      this.setCropSprite(visual, px, py, 'crop_withered');
    } else if (tile.cropId && tile.growthStage !== undefined &&
               (tile.state === 'planted' || tile.state === 'grown')) {
      const cropDef = ItemRegistry.getCrop(tile.cropId);
      if (cropDef) {
        const maxStage = cropDef.growthStages;
        const stage = tile.state === 'grown'
          ? maxStage
          : Math.min(tile.growthStage, maxStage);
        const textureKey = `${cropDef.textureKey}_${stage}`;
        this.setCropSprite(visual, px, py, textureKey);
      }
    } else {
      // Remove crop sprite if exists
      if (visual.cropSprite) {
        const idx = this.depthSortedSprites.indexOf(visual.cropSprite);
        if (idx >= 0) this.depthSortedSprites.splice(idx, 1);
        visual.cropSprite.destroy();
        visual.cropSprite = undefined;
      }
    }
  }

  private setCropSprite(visual: FarmTileVisual, px: number, py: number, textureKey: string): void {
    if (!this.textures.exists(textureKey)) return;
    if (visual.cropSprite) {
      visual.cropSprite.setTexture(textureKey);
    } else {
      visual.cropSprite = this.add.image(px, py + SCALED_TILE / 2, textureKey)
        .setScale(SCALE).setOrigin(0.5, 1);
      this.depthSortedSprites.push(visual.cropSprite);
    }
  }

  // ─── HUD ────────────────────────────────────────────────

  private createHUD(): void {
    const hudBg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD_BG);
    hudBg.fillStyle(UI_COLORS.panelBg, 0.8);
    hudBg.fillRoundedRect(GAME_WIDTH - 180, 8, 172, 60, 6);
    hudBg.lineStyle(1, UI_COLORS.panelBorder, 0.6);
    hudBg.strokeRoundedRect(GAME_WIDTH - 180, 8, 172, 60, 6);

    this.timeText = this.add.text(GAME_WIDTH - 170, 14, '6:00 AM', {
      fontSize: '16px', color: UI_COLORS.textHighlight, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);

    this.dateText = this.add.text(GAME_WIDTH - 170, 34, 'Spring 1, Year 1', {
      fontSize: '11px', color: UI_COLORS.textSecondary, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);

    this.goldText = this.add.text(GAME_WIDTH - 170, 50, `${this.saveData.player.gold}G`, {
      fontSize: '12px', color: '#ffcc00', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);

    const energyBg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD_BG);
    energyBg.fillStyle(UI_COLORS.panelBg, 0.8);
    energyBg.fillRoundedRect(8, 8, 120, 35, 6);
    energyBg.lineStyle(1, UI_COLORS.panelBorder, 0.6);
    energyBg.strokeRoundedRect(8, 8, 120, 35, 6);

    this.add.text(14, 12, 'Energy', {
      fontSize: '10px', color: UI_COLORS.textSecondary, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);

    this.energyBar = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);
    this.drawEnergyBar();

    this.interactionPrompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 160, '[E] Interact', {
      fontSize: '12px', color: UI_COLORS.textHighlight, fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD_BG).setVisible(false);
  }

  private drawEnergyBar(): void {
    this.energyBar.clear();
    const ratio = this.saveData.player.energy / this.saveData.player.maxEnergy;
    this.energyBar.fillStyle(0x333333);
    this.energyBar.fillRect(14, 26, 106, 10);
    const barColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xcccc44 : 0xcc4444;
    this.energyBar.fillStyle(barColor);
    this.energyBar.fillRect(14, 26, 106 * ratio, 10);
  }

  // ─── EVENTS ─────────────────────────────────────────────

  private setupEvents(): void {
    this.bus.on(EVENTS.PLAYER_INTERACT, (px: number, py: number, fx: number, fy: number) => {
      if (this.dialogBox.getIsVisible()) return;
      if (this.inventoryUI.getIsVisible()) return;
      this.handlePlayerAction(px, py, fx, fy);
    });

    this.bus.on(EVENTS.FARM_TILE_UPDATED, (gx: number, gy: number, tile: FarmTile) => {
      this.updateFarmTileVisual(gx, gy, tile);
    });

    this.bus.on(EVENTS.ENERGY_CHANGED, (energy: number) => {
      this.saveData.player.energy = energy;
      this.drawEnergyBar();
    });

    this.bus.on(EVENTS.GOLD_CHANGED, (gold: number) => {
      this.saveData.player.gold = gold;
      this.goldText.setText(`${gold}G`);
    });

    this.bus.on(EVENTS.DIALOG_CLOSE, () => {
      this.player.unfreeze();
    });

    this.bus.on('player:sleep', () => {
      this.handleSleep();
    });

    this.bus.on(EVENTS.HOTBAR_UPDATED, (items: (string | null)[]) => {
      this.saveData.player.hotbar = [...items];
    });

    // Debug event: add gold
    this.bus.on('debug:addGold', (amount: number) => {
      this.saveData.player.gold += amount;
      this.goldText.setText(`${this.saveData.player.gold}G`);
    });
  }

  private handlePlayerAction(px: number, py: number, fx: number, fy: number): void {
    const targetPx = px + fx * SCALED_TILE;
    const targetPy = py + fy * SCALED_TILE;
    const { gx, gy } = pixelToGrid(targetPx, targetPy);

    const selectedItemId = this.hotbar.getSelectedItem();

    // 1. World object interactions always take priority (signs, NPCs, doors, etc.)
    const nearest = this.interactionSystem.findNearest(px, py, fx, fy);
    if (nearest) {
      const result = this.interactionSystem.interact(nearest, px, py);
      switch (result.type) {
        case 'dialog':
        case 'locked':
          this.player.freeze();
          this.dialogBox.show({
            text: result.text || '',
            choices: result.choices,
            callback: (choice) => {
              if (result.callback) result.callback(choice);
              this.player.unfreeze();
            },
          });
          return;
        case 'action':
          if (result.callback) result.callback();
          return;
        case 'battle':
          if (result.callback) result.callback();
          return;
        case 'menu':
          if (result.callback) result.callback();
          return;
      }
    }

    // 2. Harvest grown crops (bare hands)
    if (this.farmingSystem.isInFarmArea(gx, gy)) {
      const farmTile = this.farmingSystem.getTile(gx, gy);
      if (farmTile?.state === 'grown') {
        const harvestResult = this.toolSystem.harvestCrop(gx, gy);
        if (harvestResult.success) {
          this.saveData.player.stats.cropsHarvested++;
          if (harvestResult.message) this.showNotification(harvestResult.message);
          return;
        }
      }
    }

    // 3. Use tool or plant seed
    if (selectedItemId) {
      const itemDef = ItemRegistry.getItem(selectedItemId);
      if (itemDef && (itemDef.category === 'tool' || itemDef.category === 'seed')) {
        const timeState = this.timeSystem.getState();
        const result = this.toolSystem.useItem(
          selectedItemId, gx, gy, timeState.season, timeState.day
        );
        if (result.success || result.message) {
          if (result.message) this.showNotification(result.message);
          return;
        }
      }
    }
  }

  // ─── INVENTORY ──────────────────────────────────────────

  private toggleInventory(): void {
    if (this.dialogBox.getIsVisible()) return;
    if (this.inventoryUI.getIsVisible()) {
      this.inventoryUI.hide();
      this.player.unfreeze();
      this.timeSystem.resume();
    } else {
      this.inventoryUI.show();
      this.player.freeze();
      this.timeSystem.pause();
    }
  }

  // ─── SLEEP / NEW DAY ───────────────────────────────────

  private handleSleep(): void {
    this.player.freeze();
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.timeSystem.advanceToNextDay();
      this.saveData.time = { ...this.saveData.time, ...this.timeSystem.getState() };

      const currentSeason = this.timeSystem.getState().season;
      this.farmingSystem.onNewDay(currentSeason);
      this.processShippingBin();

      this.saveData.player.energy = this.saveData.player.maxEnergy;
      this.saveData.player.health = this.saveData.player.maxHealth;
      this.toolSystem.setEnergy(this.saveData.player.energy, this.saveData.player.maxEnergy);
      this.saveData.player.stats.daysPlayed++;

      this.refreshAllFarmVisuals();

      this.saveData.player.position = { x: this.player.x, y: this.player.y };
      this.saveData.farmTiles = this.farmingSystem.serialize();
      this.saveData.inventory = this.inventorySystem.serialize();
      SaveSystem.saveToSlot(this.currentSlot, this.saveData);

      this.cameras.main.fadeIn(1000, 0, 0, 0);
      this.cameras.main.once('camerafadeincomplete', () => {
        this.player.unfreeze();
        this.showNotification(this.timeSystem.getFormattedDate());
      });
    });
  }

  private processShippingBin(): void {
    if (!this.saveData.shippingBin?.length) return;
    let totalGold = 0;
    for (const item of this.saveData.shippingBin) {
      const itemDef = ItemRegistry.getItem(item.id);
      if (itemDef?.sellPrice) totalGold += itemDef.sellPrice * item.quantity;
    }
    if (totalGold > 0) {
      this.saveData.player.gold += totalGold;
      this.saveData.player.stats.totalEarnings += totalGold;
      this.goldText.setText(`${this.saveData.player.gold}G`);
    }
    this.saveData.shippingBin = [];
  }

  private refreshAllFarmVisuals(): void {
    for (const visual of this.farmTileVisuals.values()) {
      visual.tileSprite.destroy();
      if (visual.cropSprite) {
        const idx = this.depthSortedSprites.indexOf(visual.cropSprite);
        if (idx >= 0) this.depthSortedSprites.splice(idx, 1);
        visual.cropSprite.destroy();
      }
    }
    this.farmTileVisuals.clear();
    this.buildFarmTileOverlays();
  }

  // ─── PAUSE / SAVE ──────────────────────────────────────

  private openPauseMenu(): void {
    if (this.inventoryUI.getIsVisible()) {
      this.inventoryUI.hide();
      this.player.unfreeze();
      this.timeSystem.resume();
      return;
    }
    if (this.dialogBox.getIsVisible()) {
      this.dialogBox.hide();
      return;
    }
    this.player.freeze();
    this.timeSystem.pause();
    this.dialogBox.show({
      text: 'Game Paused',
      choices: ['Resume', 'Save Game', 'Settings', 'Quit to Menu'],
      callback: (choice) => {
        switch (choice) {
          case 'Resume':
            this.player.unfreeze();
            this.timeSystem.resume();
            break;
          case 'Save Game':
            this.saveGame();
            this.player.unfreeze();
            this.timeSystem.resume();
            this.showNotification('Game Saved!');
            break;
          case 'Settings':
            this.player.unfreeze();
            this.timeSystem.resume();
            break;
          case 'Quit to Menu':
            this.saveGame();
            this.bus.removeAll();
            this.scene.start(SCENES.MENU);
            break;
          default:
            this.player.unfreeze();
            this.timeSystem.resume();
        }
      },
    });
  }

  private saveGame(): void {
    this.saveData.player.position = { x: this.player.x, y: this.player.y };
    this.saveData.player.facing = this.player.facing;
    this.saveData.player.energy = this.toolSystem.getEnergy();
    const timeState = this.timeSystem.getState();
    this.saveData.time = {
      day: timeState.day, season: timeState.season, year: timeState.year,
      hour: timeState.hour, minute: timeState.minute,
    };
    this.saveData.farmTiles = this.farmingSystem.serialize();
    this.saveData.inventory = this.inventorySystem.serialize();
    SaveSystem.saveToSlot(this.currentSlot, this.saveData);
  }

  private showNotification(text: string): void {
    const notif = this.add.text(GAME_WIDTH / 2, 100, text, {
      fontSize: '20px', color: UI_COLORS.textHighlight, fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.NOTIFICATION);
    this.tweens.add({
      targets: notif, alpha: { from: 1, to: 0 }, y: 80,
      duration: 3000, ease: 'Power2', onComplete: () => notif.destroy(),
    });
  }

  // ─── UPDATE LOOP ────────────────────────────────────────

  update(_time: number, delta: number): void {
    this.player.update();
    this.timeSystem.update(delta);

    this.timeText.setText(this.timeSystem.getFormattedTime());
    this.dateText.setText(this.timeSystem.getFormattedDate());
    this.drawEnergyBar();

    const tint = this.timeSystem.getDayNightTint();
    const light = this.timeSystem.getAmbientLight();
    this.dayNightOverlay.setFillStyle(tint, 1 - light);

    for (const sprite of this.depthSortedSprites) {
      sprite.setDepth(sprite.y);
    }

    // Interaction prompt
    if (!this.dialogBox.getIsVisible() && !this.inventoryUI.getIsVisible()) {
      const facing = this.player.getFacingVector();
      const targetPx = this.player.x + facing.x * SCALED_TILE;
      const targetPy = this.player.y + facing.y * SCALED_TILE;
      const { gx, gy } = pixelToGrid(targetPx, targetPy);

      const selectedItemId = this.hotbar.getSelectedItem();
      const nearest = this.interactionSystem.findNearest(
        this.player.x, this.player.y, facing.x, facing.y
      );

      // World object interactions take priority in the prompt
      if (nearest) {
        this.interactionPrompt.setText('[E] Interact');
        this.interactionPrompt.setVisible(true);
      } else if (this.farmingSystem.isInFarmArea(gx, gy)) {
        const farmTile = this.farmingSystem.getTile(gx, gy);
        if (farmTile?.state === 'grown') {
          this.interactionPrompt.setText('[E] Harvest');
          this.interactionPrompt.setVisible(true);
        } else if (selectedItemId) {
          const itemDef = ItemRegistry.getItem(selectedItemId);
          if (itemDef && (itemDef.category === 'tool' || itemDef.category === 'seed')) {
            this.interactionPrompt.setText(`[E] Use ${itemDef.name}`);
            this.interactionPrompt.setVisible(true);
          } else {
            this.interactionPrompt.setVisible(false);
          }
        } else {
          this.interactionPrompt.setVisible(false);
        }
      } else {
        this.interactionPrompt.setVisible(false);
      }
    } else {
      this.interactionPrompt.setVisible(false);
    }

    if (this.colliders) {
      this.physics.collide(this.player, this.colliders);
    }

    // Debug panel update
    if (this.debugPanel) {
      this.debugPanel.update(this.player);
    }
  }

  shutdown(): void {
    this.bus.removeAll();
    if (this.debugPanel) {
      this.debugPanel.destroy();
      this.debugPanel = null;
    }
  }
}
