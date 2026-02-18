import Phaser from 'phaser';
import { TILE_SIZE, TERRAIN_COLORS, UI_COLORS, TYPE_COLORS, MonsterType } from './Constants';

/**
 * Generates all placeholder pixel art sprites at runtime.
 * Every asset generated here can be swapped for real art later by
 * replacing the texture key with a loaded image in BootScene.
 */
export class AssetGenerator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  generateAll(): void {
    this.generateTileset();
    this.generatePlayerSprites();
    this.generateUIElements();
    this.generateToolIcons();
    this.generateInteractableObjects();
    this.generateMonsterPlaceholders();
  }

  private createCanvas(width: number, height: number): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext('2d')!;
  }

  private colorToCSS(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private generateTileset(): void {
    const tileNames: [string, number][] = [
      ['tile_grass', TERRAIN_COLORS.grass],
      ['tile_dirt', TERRAIN_COLORS.dirt],
      ['tile_tilled', TERRAIN_COLORS.tilled],
      ['tile_water', TERRAIN_COLORS.water],
      ['tile_sand', TERRAIN_COLORS.sand],
      ['tile_stone', TERRAIN_COLORS.stone],
      ['tile_path', TERRAIN_COLORS.path],
      ['tile_wall', TERRAIN_COLORS.wall],
      ['tile_roof', TERRAIN_COLORS.roof],
      ['tile_door', TERRAIN_COLORS.door],
      ['tile_fence', TERRAIN_COLORS.fence],
      ['tile_wood_floor', 0x8b7355],
    ];

    for (const [name, color] of tileNames) {
      const ctx = this.createCanvas(TILE_SIZE, TILE_SIZE);
      const cssColor = this.colorToCSS(color);

      // Base fill
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

      // Add some noise/texture
      this.addPixelNoise(ctx, color, TILE_SIZE, TILE_SIZE, 0.15);

      // Grass gets little darker patches
      if (name === 'tile_grass') {
        ctx.fillStyle = this.colorToCSS(0x4a7a2c);
        // Random-looking but deterministic grass blades
        const positions = [[2, 3], [7, 8], [12, 5], [4, 12], [10, 14], [14, 2]];
        for (const [px, py] of positions) {
          ctx.fillRect(px, py, 1, 2);
        }
      }

      // Water gets a wave pattern
      if (name === 'tile_water') {
        ctx.fillStyle = this.colorToCSS(0x4477bb);
        for (let wx = 0; wx < TILE_SIZE; wx += 4) {
          ctx.fillRect(wx, 6, 2, 1);
          ctx.fillRect(wx + 2, 10, 2, 1);
        }
      }

      // Fence gets vertical posts
      if (name === 'tile_fence') {
        ctx.fillStyle = this.colorToCSS(0x775522);
        ctx.fillRect(7, 0, 2, TILE_SIZE);
        ctx.fillStyle = this.colorToCSS(0xaa8844);
        ctx.fillRect(0, 4, TILE_SIZE, 2);
        ctx.fillRect(0, 11, TILE_SIZE, 2);
      }

      // Door gets a handle
      if (name === 'tile_door') {
        ctx.fillStyle = this.colorToCSS(0xffcc00);
        ctx.fillRect(11, 8, 2, 2);
      }

      this.scene.textures.addCanvas(name, ctx.canvas);
    }
  }

  private generatePlayerSprites(): void {
    const directions: ['down', 'up', 'left', 'right'] = ['down', 'up', 'left', 'right'];
    const frames: number[] = [0, 1, 2]; // idle, walk1, walk2

    // Generate a spritesheet: 3 frames x 4 directions = 12 frames
    const frameWidth = TILE_SIZE;
    const frameHeight = TILE_SIZE;
    const sheetWidth = frameWidth * 3;
    const sheetHeight = frameHeight * 4;
    const ctx = this.createCanvas(sheetWidth, sheetHeight);

    for (let dir = 0; dir < 4; dir++) {
      for (let frame = 0; frame < 3; frame++) {
        const ox = frame * frameWidth;
        const oy = dir * frameHeight;
        this.drawPlayerFrame(ctx, ox, oy, directions[dir], frame);
      }
    }

    // Add as canvas texture, then create spritesheet frames manually
    const canvasTex = this.scene.textures.addCanvas('player', ctx.canvas);
    if (canvasTex) {
      // Add frames for spritesheet behavior
      for (let dir = 0; dir < 4; dir++) {
        for (let frame = 0; frame < 3; frame++) {
          const frameIndex = dir * 3 + frame;
          canvasTex.add(
            frameIndex, 0,
            frame * frameWidth, dir * frameHeight,
            frameWidth, frameHeight
          );
        }
      }
    }
  }

  private drawPlayerFrame(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number,
    direction: string, frame: number
  ): void {
    // Body (blue overalls - farmer style)
    ctx.fillStyle = '#4466aa';
    ctx.fillRect(ox + 5, oy + 7, 6, 6);

    // Skin (head)
    ctx.fillStyle = '#ffcc99';
    ctx.fillRect(ox + 5, oy + 2, 6, 5);

    // Hair (brown)
    ctx.fillStyle = '#553311';
    ctx.fillRect(ox + 4, oy + 1, 8, 3);

    // Eyes
    if (direction !== 'up') {
      ctx.fillStyle = '#222222';
      if (direction === 'down') {
        ctx.fillRect(ox + 6, oy + 4, 1, 1);
        ctx.fillRect(ox + 9, oy + 4, 1, 1);
      } else if (direction === 'left') {
        ctx.fillRect(ox + 5, oy + 4, 1, 1);
      } else {
        ctx.fillRect(ox + 10, oy + 4, 1, 1);
      }
    }

    // Legs
    ctx.fillStyle = '#553311';
    const legOffset = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    ctx.fillRect(ox + 5 + legOffset, oy + 13, 2, 3);
    ctx.fillRect(ox + 9 - legOffset, oy + 13, 2, 3);

    // Arms
    ctx.fillStyle = '#ffcc99';
    if (direction === 'left') {
      ctx.fillRect(ox + 3, oy + 8, 2, 4);
    } else if (direction === 'right') {
      ctx.fillRect(ox + 11, oy + 8, 2, 4);
    } else {
      ctx.fillRect(ox + 3, oy + 8, 2, 4);
      ctx.fillRect(ox + 11, oy + 8, 2, 4);
    }
  }

  private generateUIElements(): void {
    // Hotbar background
    const hotbarCtx = this.createCanvas(182, 24);
    hotbarCtx.fillStyle = this.colorToCSS(UI_COLORS.hotbarBg);
    hotbarCtx.fillRect(0, 0, 182, 24);
    hotbarCtx.strokeStyle = this.colorToCSS(UI_COLORS.panelBorder);
    hotbarCtx.lineWidth = 2;
    hotbarCtx.strokeRect(1, 1, 180, 22);
    this.scene.textures.addCanvas('hotbar_bg', hotbarCtx.canvas);

    // Hotbar slot
    const slotCtx = this.createCanvas(18, 18);
    slotCtx.fillStyle = this.colorToCSS(UI_COLORS.hotbarSlot);
    slotCtx.fillRect(0, 0, 18, 18);
    slotCtx.strokeStyle = this.colorToCSS(UI_COLORS.panelBorder);
    slotCtx.lineWidth = 1;
    slotCtx.strokeRect(0, 0, 18, 18);
    this.scene.textures.addCanvas('hotbar_slot', slotCtx.canvas);

    // Selected slot highlight
    const selectedCtx = this.createCanvas(18, 18);
    selectedCtx.fillStyle = this.colorToCSS(UI_COLORS.hotbarSlot);
    selectedCtx.fillRect(0, 0, 18, 18);
    selectedCtx.strokeStyle = this.colorToCSS(UI_COLORS.hotbarSelected);
    selectedCtx.lineWidth = 2;
    selectedCtx.strokeRect(0, 0, 18, 18);
    this.scene.textures.addCanvas('hotbar_slot_selected', selectedCtx.canvas);

    // Dialog box background (stretched at runtime)
    const dialogCtx = this.createCanvas(4, 4);
    dialogCtx.fillStyle = this.colorToCSS(UI_COLORS.dialogBg);
    dialogCtx.fillRect(0, 0, 4, 4);
    this.scene.textures.addCanvas('dialog_bg', dialogCtx.canvas);

    // Panel background
    const panelCtx = this.createCanvas(4, 4);
    panelCtx.fillStyle = this.colorToCSS(UI_COLORS.panelBg);
    panelCtx.fillRect(0, 0, 4, 4);
    this.scene.textures.addCanvas('panel_bg', panelCtx.canvas);

    // Button
    const btnCtx = this.createCanvas(4, 4);
    btnCtx.fillStyle = this.colorToCSS(UI_COLORS.buttonBg);
    btnCtx.fillRect(0, 0, 4, 4);
    this.scene.textures.addCanvas('button_bg', btnCtx.canvas);
  }

  private generateToolIcons(): void {
    const tools: [string, number, (ctx: CanvasRenderingContext2D) => void][] = [
      ['icon_hoe', 0x8b6914, (ctx) => {
        // Handle
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(2, 2, 2, 12);
        // Head
        ctx.fillStyle = '#999999';
        ctx.fillRect(1, 12, 6, 3);
      }],
      ['icon_watering_can', 0x4488ff, (ctx) => {
        // Body
        ctx.fillStyle = '#6688aa';
        ctx.fillRect(3, 5, 8, 8);
        // Spout
        ctx.fillStyle = '#6688aa';
        ctx.fillRect(11, 6, 3, 2);
        // Handle
        ctx.fillStyle = '#555555';
        ctx.fillRect(5, 2, 4, 3);
      }],
      ['icon_axe', 0xcc4444, (ctx) => {
        // Handle
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(3, 3, 2, 11);
        // Head
        ctx.fillStyle = '#999999';
        ctx.fillRect(5, 3, 5, 4);
        ctx.fillRect(7, 2, 3, 1);
      }],
      ['icon_shovel', 0x886644, (ctx) => {
        // Handle
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(7, 1, 2, 10);
        // Blade
        ctx.fillStyle = '#999999';
        ctx.fillRect(5, 10, 6, 4);
        ctx.fillRect(6, 14, 4, 1);
      }],
      ['icon_fishing_rod', 0x44aacc, (ctx) => {
        // Rod
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(3, 1, 2, 12);
        // Line
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(5, 1, 6, 1);
        ctx.fillRect(11, 1, 1, 8);
        // Hook
        ctx.fillStyle = '#999999';
        ctx.fillRect(10, 9, 2, 2);
        ctx.fillRect(10, 11, 1, 1);
      }],
      ['icon_pickaxe', 0xaaaaaa, (ctx) => {
        // Handle
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(7, 5, 2, 10);
        // Head
        ctx.fillStyle = '#999999';
        ctx.fillRect(2, 2, 12, 3);
        ctx.fillRect(1, 3, 2, 2);
        ctx.fillRect(13, 3, 2, 2);
      }],
    ];

    for (const [name, , drawFn] of tools) {
      const ctx = this.createCanvas(TILE_SIZE, TILE_SIZE);
      drawFn(ctx);
      this.scene.textures.addCanvas(name, ctx.canvas);
    }
  }

  private generateInteractableObjects(): void {
    // Sign post
    const signCtx = this.createCanvas(TILE_SIZE, TILE_SIZE);
    signCtx.fillStyle = '#8b6914';
    signCtx.fillRect(6, 8, 4, 8); // post
    signCtx.fillStyle = '#aa8844';
    signCtx.fillRect(2, 2, 12, 7); // board
    signCtx.strokeStyle = '#664400';
    signCtx.lineWidth = 1;
    signCtx.strokeRect(2, 2, 12, 7);
    this.scene.textures.addCanvas('sign', signCtx.canvas);

    // Chest / storage
    const chestCtx = this.createCanvas(TILE_SIZE, TILE_SIZE);
    chestCtx.fillStyle = '#8b6914';
    chestCtx.fillRect(2, 6, 12, 8);
    chestCtx.fillStyle = '#aa8844';
    chestCtx.fillRect(2, 4, 12, 4);
    chestCtx.fillStyle = '#ffcc00';
    chestCtx.fillRect(6, 8, 4, 2); // lock
    this.scene.textures.addCanvas('chest', chestCtx.canvas);

    // Tree
    const treeCtx = this.createCanvas(TILE_SIZE, TILE_SIZE * 2);
    // Trunk
    treeCtx.fillStyle = '#664400';
    treeCtx.fillRect(6, 16, 4, 16);
    // Leaves
    treeCtx.fillStyle = '#338833';
    treeCtx.fillRect(2, 2, 12, 14);
    treeCtx.fillStyle = '#44aa44';
    treeCtx.fillRect(4, 0, 8, 4);
    treeCtx.fillRect(1, 6, 14, 8);
    this.addPixelNoise(treeCtx, 0x338833, TILE_SIZE, TILE_SIZE * 2, 0.1);
    this.scene.textures.addCanvas('tree', treeCtx.canvas);

    // Stump
    const stumpCtx = this.createCanvas(TILE_SIZE, TILE_SIZE);
    stumpCtx.fillStyle = '#664400';
    stumpCtx.fillRect(3, 6, 10, 8);
    stumpCtx.fillStyle = '#886644';
    stumpCtx.fillRect(3, 4, 10, 4);
    stumpCtx.fillStyle = '#553300';
    // rings
    stumpCtx.fillRect(6, 5, 4, 1);
    stumpCtx.fillRect(5, 6, 6, 1);
    this.scene.textures.addCanvas('stump', stumpCtx.canvas);

    // Rock
    const rockCtx = this.createCanvas(TILE_SIZE, TILE_SIZE);
    rockCtx.fillStyle = '#888888';
    rockCtx.fillRect(3, 6, 10, 8);
    rockCtx.fillStyle = '#999999';
    rockCtx.fillRect(4, 4, 8, 4);
    rockCtx.fillStyle = '#aaaaaa';
    rockCtx.fillRect(5, 5, 3, 2);
    this.scene.textures.addCanvas('rock', rockCtx.canvas);

    // House (2x2 tiles)
    const houseCtx = this.createCanvas(TILE_SIZE * 3, TILE_SIZE * 3);
    // Walls
    houseCtx.fillStyle = this.colorToCSS(TERRAIN_COLORS.wall);
    houseCtx.fillRect(4, 16, 40, 28);
    // Roof
    houseCtx.fillStyle = this.colorToCSS(TERRAIN_COLORS.roof);
    houseCtx.fillRect(0, 4, 48, 14);
    houseCtx.fillStyle = '#993322';
    houseCtx.fillRect(8, 0, 32, 8);
    // Door
    houseCtx.fillStyle = this.colorToCSS(TERRAIN_COLORS.door);
    houseCtx.fillRect(18, 28, 12, 16);
    // Windows
    houseCtx.fillStyle = '#aaccff';
    houseCtx.fillRect(8, 22, 6, 6);
    houseCtx.fillRect(34, 22, 6, 6);
    this.scene.textures.addCanvas('house', houseCtx.canvas);

    // Mailbox
    const mailCtx = this.createCanvas(TILE_SIZE, TILE_SIZE);
    mailCtx.fillStyle = '#664400';
    mailCtx.fillRect(7, 6, 2, 10);
    mailCtx.fillStyle = '#4466aa';
    mailCtx.fillRect(3, 2, 10, 6);
    mailCtx.fillStyle = '#cc3333';
    mailCtx.fillRect(13, 3, 2, 3);
    this.scene.textures.addCanvas('mailbox', mailCtx.canvas);

    // Shipping bin
    const binCtx = this.createCanvas(TILE_SIZE, TILE_SIZE);
    binCtx.fillStyle = '#8b6914';
    binCtx.fillRect(1, 4, 14, 12);
    binCtx.fillStyle = '#aa8844';
    binCtx.fillRect(1, 2, 14, 4);
    binCtx.fillStyle = '#664400';
    binCtx.fillRect(0, 6, 16, 1);
    this.scene.textures.addCanvas('shipping_bin', binCtx.canvas);

    // Worm spot (dig spot)
    const wormCtx = this.createCanvas(TILE_SIZE, TILE_SIZE);
    wormCtx.fillStyle = '#886644';
    wormCtx.fillRect(5, 8, 6, 4);
    wormCtx.fillStyle = '#cc8866';
    ctx_wave(wormCtx, 7, 3, 2, 6);
    this.scene.textures.addCanvas('worm_spot', wormCtx.canvas);
  }

  generateMonsterPlaceholders(): void {
    const types = Object.keys(TYPE_COLORS) as MonsterType[];
    for (const type of types) {
      const color = TYPE_COLORS[type];
      const ctx = this.createCanvas(TILE_SIZE * 2, TILE_SIZE * 2);

      // Body
      ctx.fillStyle = this.colorToCSS(color);
      ctx.fillRect(6, 8, 20, 18);

      // Head
      ctx.fillStyle = this.colorToCSS(color);
      ctx.fillRect(8, 2, 16, 12);

      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(10, 5, 4, 4);
      ctx.fillRect(18, 5, 4, 4);
      ctx.fillStyle = '#222222';
      ctx.fillRect(12, 6, 2, 2);
      ctx.fillRect(20, 6, 2, 2);

      // Type-specific features
      this.addTypeFeatures(ctx, type);

      // Lighter belly
      const lighterColor = this.lightenColor(color, 0.3);
      ctx.fillStyle = this.colorToCSS(lighterColor);
      ctx.fillRect(10, 14, 12, 10);

      this.scene.textures.addCanvas(`monster_${type.toLowerCase()}`, ctx.canvas);
    }
  }

  private addTypeFeatures(ctx: CanvasRenderingContext2D, type: MonsterType): void {
    switch (type) {
      case 'Fire':
        // Flame on tail
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(24, 12, 4, 6);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(25, 10, 2, 4);
        break;
      case 'Water':
        // Fins
        ctx.fillStyle = '#2266cc';
        ctx.fillRect(4, 10, 3, 8);
        ctx.fillRect(25, 10, 3, 8);
        break;
      case 'Grass':
        // Leaf on head
        ctx.fillStyle = '#22aa22';
        ctx.fillRect(12, 0, 8, 4);
        ctx.fillRect(14, -1, 4, 2);
        break;
      case 'Earth':
        // Rocky bumps
        ctx.fillStyle = '#666644';
        ctx.fillRect(8, 4, 3, 3);
        ctx.fillRect(20, 4, 3, 3);
        break;
      case 'Electric':
        // Lightning bolt marks
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(6, 14, 2, 4);
        ctx.fillRect(24, 14, 2, 4);
        break;
      case 'Dark':
        // Shadowy wisps
        ctx.fillStyle = '#331144';
        ctx.fillRect(4, 6, 2, 10);
        ctx.fillRect(26, 6, 2, 10);
        break;
      case 'Light':
        // Halo
        ctx.fillStyle = '#ffffcc';
        ctx.fillRect(10, 0, 12, 2);
        ctx.fillRect(8, 1, 2, 2);
        ctx.fillRect(22, 1, 2, 2);
        break;
    }
  }

  private addPixelNoise(
    ctx: CanvasRenderingContext2D, baseColor: number,
    width: number, height: number, intensity: number
  ): void {
    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8) & 0xff;
    const b = baseColor & 0xff;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (Math.random() < intensity) {
          const variation = (Math.random() - 0.5) * 40;
          const nr = Math.max(0, Math.min(255, r + variation));
          const ng = Math.max(0, Math.min(255, g + variation));
          const nb = Math.max(0, Math.min(255, b + variation));
          ctx.fillStyle = `rgb(${nr},${ng},${nb})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  private lightenColor(color: number, amount: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + 255 * amount);
    const g = Math.min(255, ((color >> 8) & 0xff) + 255 * amount);
    const b = Math.min(255, (color & 0xff) + 255 * amount);
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }
}

/** Helper to draw a wavy worm shape */
function ctx_wave(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  for (let i = 0; i < height; i++) {
    const offset = Math.sin(i * 1.5) * 1.5;
    ctx.fillRect(x + offset, y + i, width, 1);
  }
}
