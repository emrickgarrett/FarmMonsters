import Phaser from 'phaser';
import {
  SCENES, TILE_SIZE, SCALE, SCALED_TILE, GAME_WIDTH, GAME_HEIGHT,
  FARM_WIDTH, FARM_HEIGHT, EVENTS, UI_COLORS,
} from '../utils/Constants';
import { EventBus } from '../utils/EventBus';
import { Player } from '../entities/Player';
import { TimeSystem } from '../systems/TimeSystem';
import { InteractionSystem, Interactable } from '../systems/InteractionSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { SaveData } from '../models/SaveData';
import { DialogBox } from '../ui/DialogBox';
import { Hotbar } from '../ui/Hotbar';

/** Depth constants: ground is always behind world objects; UI is always on top. */
const DEPTH = {
  GROUND: 0,        // flat tiles (grass, dirt, paths, water, fences)
  // World objects and the player use their Y position as depth (typically 50-1500)
  DAY_NIGHT: 5000,  // day/night tint overlay
  HUD_BG: 5100,     // HUD panel backgrounds
  HUD_TEXT: 5200,    // HUD text
  HOTBAR: 5300,      // hotbar
  DIALOG: 5400,      // dialog box
  NOTIFICATION: 5500,
};

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private timeSystem!: TimeSystem;
  private interactionSystem!: InteractionSystem;
  private dialogBox!: DialogBox;
  private hotbar!: Hotbar;
  private bus!: EventBus;
  private saveData!: SaveData;

  private colliders: Phaser.Physics.Arcade.StaticGroup | null = null;

  /** All game objects that participate in Y-based depth sorting (player + world objects). */
  private depthSortedSprites: Phaser.GameObjects.Image[] = [];

  // UI overlays
  private dayNightOverlay!: Phaser.GameObjects.Rectangle;
  private timeText!: Phaser.GameObjects.Text;
  private dateText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private energyBar!: Phaser.GameObjects.Graphics;
  private interactionPrompt!: Phaser.GameObjects.Text;

  // State
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

    // Build the farm map (ground tiles + objects added directly to scene)
    this.buildFarmMap();

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

    // Create UI elements
    this.createHUD();

    // Hotbar
    this.hotbar = new Hotbar(this);
    this.hotbar.setItems(this.saveData.player.hotbar);

    // Dialog box
    this.dialogBox = new DialogBox(this);

    // Setup event listeners
    this.setupEvents();

    // Setup save key
    this.input.keyboard!.on('keydown-ESC', () => this.openPauseMenu());
  }

  private buildFarmMap(): void {
    this.colliders = this.physics.add.staticGroup();

    const mapWidth = FARM_WIDTH;
    const mapHeight = FARM_HEIGHT;

    // Ground tiles — all at DEPTH.GROUND, added directly to scene (no container)
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const px = x * SCALED_TILE + SCALED_TILE / 2;
        const py = y * SCALED_TILE + SCALED_TILE / 2;

        let tileKey = 'tile_grass';

        // Farm area (central area with dirt)
        if (x >= 8 && x < 24 && y >= 8 && y < 22) {
          tileKey = 'tile_dirt';
        }

        // Paths
        if ((x === 7 && y >= 8 && y < 22) || (y === 7 && x >= 7 && x < 25)) {
          tileKey = 'tile_path';
        }
        // Path to town (east)
        if (y >= 14 && y <= 16 && x >= 24 && x < mapWidth) {
          tileKey = 'tile_path';
        }

        // Water pond
        if (x >= 28 && x < 33 && y >= 6 && y < 10) {
          tileKey = 'tile_water';
        }

        // Stone border at edges
        if (x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1) {
          tileKey = 'tile_fence';
        }

        const tile = this.add.image(px, py, tileKey).setScale(SCALE).setDepth(DEPTH.GROUND);

        // Water and fence are colliders
        if (tileKey === 'tile_water' || tileKey === 'tile_fence') {
          const collider = this.physics.add.staticImage(px, py, tileKey)
            .setScale(SCALE)
            .setVisible(false);
          collider.body!.setSize(SCALED_TILE, SCALED_TILE);
          this.colliders!.add(collider);
        }
      }
    }

    // Place house
    const houseX = 12 * SCALED_TILE;
    const houseY = 5 * SCALED_TILE;
    const house = this.add.image(houseX, houseY, 'house').setScale(SCALE).setOrigin(0.5, 1);
    this.depthSortedSprites.push(house);

    // House collision — zone spanning the full house width, 1 tile tall at the base.
    const houseColliderWidth = TILE_SIZE * 3 * SCALE;  // 144
    const houseColliderHeight = SCALED_TILE;            // 48
    const houseZone = this.add.zone(houseX, houseY - houseColliderHeight / 2, houseColliderWidth, houseColliderHeight);
    this.physics.add.existing(houseZone, true);
    this.colliders!.add(houseZone as any);

    // Place interactable objects
    this.placeInteractables();

    // Add trees along the borders and wilderness areas
    this.placeTrees();
  }

  private placeInteractables(): void {
    // Sign near farm entrance
    this.placeObject('sign', 7 * SCALED_TILE, 14 * SCALED_TILE, {
      id: 'farm_sign',
      type: 'sign' as const,
      data: { text: 'Welcome to your farm!\nPress E or SPACE to interact with objects.\nUse 1-9 to select tools from your hotbar.' },
    });

    // Mailbox near house
    this.placeObject('mailbox', 14 * SCALED_TILE, 7 * SCALED_TILE, {
      id: 'mailbox',
      type: 'mailbox' as const,
      data: { mail: 'Dear Farmer,\nWelcome to your new life in FarmMonsters valley!\nTend your crops, catch monsters, and make friends!\n- The Mayor' },
    });

    // Shipping bin
    this.placeObject('shipping_bin', 10 * SCALED_TILE, 7 * SCALED_TILE, {
      id: 'shipping_bin',
      type: 'shipping_bin' as const,
      data: {},
    });

    // House door
    this.interactionSystem.register({
      id: 'house_door',
      x: 12 * SCALED_TILE,
      y: 7 * SCALED_TILE,
      type: 'door',
      data: { destination: 'house_interior' },
    });

    // Bed (inside house area — accessible from door interaction for now)
    this.interactionSystem.register({
      id: 'bed',
      x: 11 * SCALED_TILE,
      y: 6 * SCALED_TILE,
      type: 'bed',
      data: {},
    });

    // Chest near house
    this.placeObject('chest', 16 * SCALED_TILE, 7 * SCALED_TILE, {
      id: 'storage_chest_1',
      type: 'chest' as const,
      data: { items: [] },
    });

    // Sign near exit to town
    this.placeObject('sign', 38 * SCALED_TILE, 15 * SCALED_TILE, {
      id: 'town_sign',
      type: 'sign' as const,
      data: { text: 'Town Center - Coming Soon!\nThe path continues east toward town...' },
    });

    // Sign near pond
    this.placeObject('sign', 27 * SCALED_TILE, 6 * SCALED_TILE, {
      id: 'pond_sign',
      type: 'sign' as const,
      data: { text: 'Farm Pond\nTry fishing here!\n(Fishing coming in a future update)' },
    });
  }

  /**
   * Place a world object with collision and interaction.
   * The visible sprite uses origin(0.5, 1) so that y = bottom edge (for Y-sorting).
   * The collision zone is placed to match the visual position.
   */
  private placeObject(
    textureKey: string, x: number, y: number,
    interactConfig: { id: string; type: any; data: Record<string, any> }
  ): Phaser.GameObjects.Image {
    const obj = this.add.image(x, y, textureKey).setScale(SCALE).setOrigin(0.5, 1);
    this.depthSortedSprites.push(obj);

    // Collision zone matching the visual position.
    // With origin(0.5,1) the visual center is at (x, y - displayH/2).
    // All placed objects are 16px tiles → displayH = SCALED_TILE.
    const zone = this.add.zone(x, y - SCALED_TILE / 2, SCALED_TILE, SCALED_TILE);
    this.physics.add.existing(zone, true);
    this.colliders!.add(zone as any);

    // Register as interactable at the visual center
    this.interactionSystem.register({
      id: interactConfig.id,
      x,
      y: y - SCALED_TILE / 2,
      type: interactConfig.type,
      data: interactConfig.data,
    });

    return obj;
  }

  private placeTrees(): void {
    // Scattered trees around the farm
    const treePositions = [
      [3, 3], [5, 4], [2, 10], [4, 18], [3, 24],
      [30, 3], [35, 4], [32, 12], [34, 20], [36, 25],
      [25, 3], [27, 4], [26, 22], [28, 24],
      [6, 26], [10, 27], [15, 26], [20, 27], [25, 26],
    ];

    for (const [tx, ty] of treePositions) {
      const x = tx * SCALED_TILE;
      const y = ty * SCALED_TILE;

      // Origin at bottom-center so Y-sort uses the trunk base, not the canopy
      const tree = this.add.image(x, y, 'tree').setScale(SCALE).setOrigin(0.5, 1);
      this.depthSortedSprites.push(tree);

      // Trunk collision — small box at the base of the tree.
      const trunkSize = SCALED_TILE * 0.5; // 24px
      const trunkZone = this.add.zone(x, y - trunkSize / 2, trunkSize, trunkSize);
      this.physics.add.existing(trunkZone, true);
      this.colliders!.add(trunkZone as any);
    }

    // Some stumps
    const stumpPositions = [[15, 10], [18, 14], [22, 11]];
    for (const [sx, sy] of stumpPositions) {
      this.placeObject('stump', sx * SCALED_TILE, sy * SCALED_TILE, {
        id: `stump_${sx}_${sy}`,
        type: 'stump' as const,
        data: { text: 'A tree stump. Use an axe to remove it.' },
      });
    }

    // Some rocks
    const rockPositions = [[12, 12], [20, 9], [16, 18]];
    for (const [rx, ry] of rockPositions) {
      this.placeObject('rock', rx * SCALED_TILE, ry * SCALED_TILE, {
        id: `rock_${rx}_${ry}`,
        type: 'rock' as const,
        data: { text: 'A big rock. Use a pickaxe to break it.' },
      });
    }
  }

  private createHUD(): void {
    // Time display (top right)
    const hudBg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD_BG);
    hudBg.fillStyle(UI_COLORS.panelBg, 0.8);
    hudBg.fillRoundedRect(GAME_WIDTH - 180, 8, 172, 60, 6);
    hudBg.lineStyle(1, UI_COLORS.panelBorder, 0.6);
    hudBg.strokeRoundedRect(GAME_WIDTH - 180, 8, 172, 60, 6);

    this.timeText = this.add.text(GAME_WIDTH - 170, 14, '6:00 AM', {
      fontSize: '16px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);

    this.dateText = this.add.text(GAME_WIDTH - 170, 34, 'Spring 1, Year 1', {
      fontSize: '11px',
      color: UI_COLORS.textSecondary,
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);

    // Gold display
    this.goldText = this.add.text(GAME_WIDTH - 170, 50, `${this.saveData.player.gold}G`, {
      fontSize: '12px',
      color: '#ffcc00',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);

    // Energy bar (top left)
    const energyBg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD_BG);
    energyBg.fillStyle(UI_COLORS.panelBg, 0.8);
    energyBg.fillRoundedRect(8, 8, 120, 35, 6);
    energyBg.lineStyle(1, UI_COLORS.panelBorder, 0.6);
    energyBg.strokeRoundedRect(8, 8, 120, 35, 6);

    const energyLabel = this.add.text(14, 12, 'Energy', {
      fontSize: '10px',
      color: UI_COLORS.textSecondary,
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);

    this.energyBar = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD_TEXT);
    this.drawEnergyBar();

    // Interaction prompt
    this.interactionPrompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 160, '[E] Interact', {
      fontSize: '12px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
      backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD_BG).setVisible(false);
  }

  private drawEnergyBar(): void {
    this.energyBar.clear();
    const ratio = this.saveData.player.energy / this.saveData.player.maxEnergy;

    // Background
    this.energyBar.fillStyle(0x333333);
    this.energyBar.fillRect(14, 26, 106, 10);

    // Fill
    const barColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xcccc44 : 0xcc4444;
    this.energyBar.fillStyle(barColor);
    this.energyBar.fillRect(14, 26, 106 * ratio, 10);
  }

  private setupEvents(): void {
    // Player interaction
    this.bus.on(EVENTS.PLAYER_INTERACT, (px: number, py: number, fx: number, fy: number) => {
      if (this.dialogBox.getIsVisible()) return;

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
            break;
          case 'action':
            if (result.callback) result.callback();
            break;
          case 'battle':
            if (result.callback) result.callback();
            break;
        }
      }
    });

    // Dialog close - unfreeze player
    this.bus.on(EVENTS.DIALOG_CLOSE, () => {
      this.player.unfreeze();
    });

    // Sleep event
    this.bus.on('player:sleep', () => {
      this.handleSleep();
    });
  }

  private handleSleep(): void {
    this.player.freeze();

    // Fade out
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Advance to next day
      this.timeSystem.advanceToNextDay();
      this.saveData.time = {
        ...this.saveData.time,
        ...this.timeSystem.getState(),
      };
      this.saveData.player.energy = this.saveData.player.maxEnergy;
      this.saveData.player.health = this.saveData.player.maxHealth;
      this.saveData.player.stats.daysPlayed++;

      // Auto-save
      this.saveData.player.position = { x: this.player.x, y: this.player.y };
      SaveSystem.saveToSlot(this.currentSlot, this.saveData);

      // Fade in
      this.cameras.main.fadeIn(1000, 0, 0, 0);
      this.cameras.main.once('camerafadeincomplete', () => {
        this.player.unfreeze();

        // Show new day notification
        const dayText = this.timeSystem.getFormattedDate();
        this.showNotification(dayText);
      });
    });
  }

  private showNotification(text: string): void {
    const notif = this.add.text(GAME_WIDTH / 2, 100, text, {
      fontSize: '20px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.NOTIFICATION);

    this.tweens.add({
      targets: notif,
      alpha: { from: 1, to: 0 },
      y: 80,
      duration: 3000,
      ease: 'Power2',
      onComplete: () => notif.destroy(),
    });
  }

  private openPauseMenu(): void {
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
            // For now just resume — settings overlay TBD
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
    const timeState = this.timeSystem.getState();
    this.saveData.time = {
      day: timeState.day,
      season: timeState.season,
      year: timeState.year,
      hour: timeState.hour,
      minute: timeState.minute,
    };
    SaveSystem.saveToSlot(this.currentSlot, this.saveData);
  }

  update(time: number, delta: number): void {
    // Update player
    this.player.update();

    // Update time system
    this.timeSystem.update(delta);

    // Update HUD
    this.timeText.setText(this.timeSystem.getFormattedTime());
    this.dateText.setText(this.timeSystem.getFormattedDate());
    this.drawEnergyBar();

    // Update day/night overlay
    const tint = this.timeSystem.getDayNightTint();
    const light = this.timeSystem.getAmbientLight();
    this.dayNightOverlay.setFillStyle(tint, 1 - light);

    // Y-sort all world objects for proper depth.
    // Every sprite's depth = its y position (bottom edge due to origin 0.5,1).
    // This means sprites lower on screen render in front of sprites higher up,
    // giving the classic 2D top-down depth illusion.
    for (const sprite of this.depthSortedSprites) {
      sprite.setDepth(sprite.y);
    }

    // Check for nearby interactables to show prompt
    if (!this.dialogBox.getIsVisible()) {
      const facing = this.player.getFacingVector();
      const nearest = this.interactionSystem.findNearest(
        this.player.x, this.player.y, facing.x, facing.y
      );
      this.interactionPrompt.setVisible(nearest !== null);
    } else {
      this.interactionPrompt.setVisible(false);
    }

    // Add player collision with map colliders
    if (this.colliders) {
      this.physics.collide(this.player, this.colliders);
    }
  }

  shutdown(): void {
    this.bus.removeAll();
  }
}
