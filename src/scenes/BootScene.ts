import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT, UI_COLORS } from '../utils/Constants';
import { AssetGenerator } from '../utils/AssetGenerator';
import { ItemRegistry } from '../data/ItemRegistry';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  preload(): void {
    // Show loading bar
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();

    progressBox.fillStyle(UI_COLORS.panelBg, 0.8);
    progressBox.fillRect(GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2 - 15, 320, 30);

    const loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'Loading...', {
      fontSize: '16px',
      color: UI_COLORS.textPrimary,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(UI_COLORS.xpBar, 1);
      progressBar.fillRect(GAME_WIDTH / 2 - 155, GAME_HEIGHT / 2 - 10, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load JSON data files
    this.load.json('items_data', 'assets/data/items.json');
    this.load.json('crops_data', 'assets/data/crops.json');
  }

  create(): void {
    // Initialize item/crop registry from loaded JSON
    const itemsData = this.cache.json.get('items_data');
    const cropsData = this.cache.json.get('crops_data');
    if (itemsData) ItemRegistry.loadItems(itemsData);
    if (cropsData) ItemRegistry.loadCrops(cropsData);

    // Generate all placeholder assets
    const assetGen = new AssetGenerator(this);
    assetGen.generateAll();

    // Create player animations
    this.createPlayerAnimations();

    // Transition to menu
    this.scene.start(SCENES.MENU);
  }

  private createPlayerAnimations(): void {
    const directions = ['down', 'up', 'left', 'right'];
    const frameRate = 6;

    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i];
      const baseFrame = i * 3;

      // Idle
      this.anims.create({
        key: `player_idle_${dir}`,
        frames: [{ key: 'player', frame: baseFrame }],
        frameRate: 1,
        repeat: -1,
      });

      // Walk
      this.anims.create({
        key: `player_walk_${dir}`,
        frames: [
          { key: 'player', frame: baseFrame + 1 },
          { key: 'player', frame: baseFrame },
          { key: 'player', frame: baseFrame + 2 },
          { key: 'player', frame: baseFrame },
        ],
        frameRate,
        repeat: -1,
      });
    }
  }
}
