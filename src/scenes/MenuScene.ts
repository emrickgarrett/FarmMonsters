import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT, UI_COLORS, HOTBAR_SLOTS } from '../utils/Constants';
import { SaveSystem } from '../systems/SaveSystem';
import { createDefaultPlayerData } from '../models/PlayerData';
import { createNewSaveData, createDefaultSettings, GameSettings, SETTINGS_KEY, SAVE_KEY_PREFIX, MAX_SAVE_SLOTS } from '../models/SaveData';

type MenuState = 'main' | 'newGame' | 'loadGame' | 'settings' | 'credits';

export class MenuScene extends Phaser.Scene {
  private menuState: MenuState = 'main';
  private menuItems: Phaser.GameObjects.Text[] = [];
  private selectedIndex: number = 0;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private panelContainer!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private nameInput: string = '';
  private settings: GameSettings = createDefaultSettings();

  // Credits scrolling state
  private creditsContent: Phaser.GameObjects.Container | null = null;
  private creditsMask: Phaser.Display.Masks.GeometryMask | null = null;
  private creditsScrollY: number = 0;
  private creditsMaxScroll: number = 0;
  private creditsViewportHeight: number = 0;
  // Scrollbar elements
  private scrollTrack: Phaser.GameObjects.Graphics | null = null;
  private scrollThumb: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: SCENES.MENU });
  }

  create(): void {
    // Load saved settings
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      this.settings = JSON.parse(savedSettings);
    }

    this.cursors = this.input.keyboard!.createCursorKeys();

    // Background
    this.bgGraphics = this.add.graphics();
    this.drawMenuBackground();

    // Title
    this.titleText = this.add.text(GAME_WIDTH / 2, 80, 'FarmMonsters', {
      fontSize: '48px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.subtitleText = this.add.text(GAME_WIDTH / 2, 125, 'Grow Crops. Catch Monsters. Save the Farm.', {
      fontSize: '14px',
      color: UI_COLORS.textSecondary,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Container for menu panels
    this.panelContainer = this.add.container(0, 0);

    this.showMainMenu();

    // Keyboard navigation
    this.input.keyboard!.on('keydown-UP', () => this.navigateMenu(-1));
    this.input.keyboard!.on('keydown-DOWN', () => this.navigateMenu(1));
    this.input.keyboard!.on('keydown-W', () => this.navigateMenu(-1));
    this.input.keyboard!.on('keydown-S', () => this.navigateMenu(1));
    this.input.keyboard!.on('keydown-ENTER', () => this.selectMenuItem());
    this.input.keyboard!.on('keydown-SPACE', () => this.selectMenuItem());
    this.input.keyboard!.on('keydown-ESC', () => this.goBack());
  }

  private drawMenuBackground(): void {
    this.bgGraphics.clear();

    // Dark gradient-like background
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      const t = y / GAME_HEIGHT;
      const r = Math.floor(20 + t * 20);
      const g = Math.floor(30 + t * 15);
      const b = Math.floor(15 + t * 25);
      this.bgGraphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b));
      this.bgGraphics.fillRect(0, y, GAME_WIDTH, 4);
    }

    // Decorative pixel stars
    this.bgGraphics.fillStyle(0xffffff, 0.5);
    const starPositions = [
      [50, 30], [150, 60], [300, 25], [500, 45], [650, 35],
      [100, 90], [400, 70], [750, 55], [200, 50], [600, 80],
    ];
    for (const [sx, sy] of starPositions) {
      this.bgGraphics.fillRect(sx, sy, 2, 2);
    }

    // Ground line
    this.bgGraphics.fillStyle(GAME_WIDTH < 0 ? 0 : 0x3a5a2c);
    this.bgGraphics.fillRect(0, GAME_HEIGHT - 60, GAME_WIDTH, 60);
    this.bgGraphics.fillStyle(0x4a7a3c);
    this.bgGraphics.fillRect(0, GAME_HEIGHT - 60, GAME_WIDTH, 4);
  }

  private clearPanel(): void {
    // Clean up credits scrolling resources
    this.destroyCreditsScroll();

    this.panelContainer.removeAll(true);
    this.menuItems = [];
    this.selectedIndex = 0;
  }

  private destroyCreditsScroll(): void {
    if (this.creditsMask) {
      this.creditsMask.destroy();
      this.creditsMask = null;
    }
    if (this.creditsContent) {
      this.creditsContent.destroy();
      this.creditsContent = null;
    }
    this.scrollTrack = null;
    this.scrollThumb = null;
    this.creditsScrollY = 0;
    this.creditsMaxScroll = 0;
  }

  private showMainMenu(): void {
    this.menuState = 'main';
    this.clearPanel();

    const items = ['New Game', 'Load Game', 'Settings', 'Credits'];
    const startY = 220;

    for (let i = 0; i < items.length; i++) {
      const text = this.add.text(GAME_WIDTH / 2, startY + i * 50, items[i], {
        fontSize: '24px',
        color: UI_COLORS.textPrimary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => {
        this.selectedIndex = i;
        this.updateMenuHighlight();
      });
      text.on('pointerdown', () => {
        this.selectedIndex = i;
        this.selectMenuItem();
      });

      this.menuItems.push(text);
      this.panelContainer.add(text);
    }

    this.updateMenuHighlight();
  }

  private showNewGameScreen(): void {
    this.menuState = 'newGame';
    this.clearPanel();
    this.nameInput = '';

    // Panel background
    const panel = this.add.graphics();
    panel.fillStyle(UI_COLORS.panelBg, 0.9);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 200, 180, 400, 280, 8);
    panel.lineStyle(2, UI_COLORS.panelBorder);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 200, 180, 400, 280, 8);
    this.panelContainer.add(panel);

    const title = this.add.text(GAME_WIDTH / 2, 210, 'New Game', {
      fontSize: '28px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.panelContainer.add(title);

    const nameLabel = this.add.text(GAME_WIDTH / 2, 260, 'Enter Your Name:', {
      fontSize: '16px',
      color: UI_COLORS.textSecondary,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.panelContainer.add(nameLabel);

    // Name input display
    const nameDisplay = this.add.text(GAME_WIDTH / 2, 300, '|', {
      fontSize: '20px',
      color: UI_COLORS.textPrimary,
      fontFamily: 'monospace',
      backgroundColor: '#1a1208',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5);
    this.panelContainer.add(nameDisplay);

    // Listen for keyboard input
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (this.menuState !== 'newGame') return;

      if (event.key === 'Backspace') {
        this.nameInput = this.nameInput.slice(0, -1);
      } else if (event.key === 'Enter' && this.nameInput.length > 0) {
        this.startNewGame(this.nameInput);
        return;
      } else if (event.key === 'Escape') {
        this.goBack();
        return;
      } else if (event.key.length === 1 && this.nameInput.length < 16) {
        this.nameInput += event.key;
      }
      nameDisplay.setText(this.nameInput + '|');
    });

    // Start button
    const startBtn = this.add.text(GAME_WIDTH / 2, 380, '[ Start Adventure ]', {
      fontSize: '20px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    startBtn.on('pointerdown', () => {
      if (this.nameInput.length > 0) {
        this.startNewGame(this.nameInput);
      }
    });
    startBtn.on('pointerover', () => startBtn.setColor('#ffffff'));
    startBtn.on('pointerout', () => startBtn.setColor(UI_COLORS.textHighlight));
    this.panelContainer.add(startBtn);

    // Back button
    const backBtn = this.add.text(GAME_WIDTH / 2, 430, '[ Back ]', {
      fontSize: '16px',
      color: UI_COLORS.textSecondary,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.goBack());
    this.panelContainer.add(backBtn);
  }

  private showLoadGameScreen(): void {
    this.menuState = 'loadGame';
    this.clearPanel();

    const panel = this.add.graphics();
    panel.fillStyle(UI_COLORS.panelBg, 0.9);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 200, 180, 400, 300, 8);
    panel.lineStyle(2, UI_COLORS.panelBorder);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 200, 180, 400, 300, 8);
    this.panelContainer.add(panel);

    const title = this.add.text(GAME_WIDTH / 2, 210, 'Load Game', {
      fontSize: '28px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.panelContainer.add(title);

    for (let slot = 0; slot < MAX_SAVE_SLOTS; slot++) {
      const saveData = SaveSystem.loadFromSlot(slot);
      const y = 270 + slot * 60;

      let label: string;
      if (saveData) {
        const date = new Date(saveData.timestamp);
        const dateStr = date.toLocaleDateString();
        label = `Slot ${slot + 1}: ${saveData.player.name} - Day ${saveData.time.day}, Year ${saveData.time.year} (${dateStr})`;
      } else {
        label = `Slot ${slot + 1}: Empty`;
      }

      const slotText = this.add.text(GAME_WIDTH / 2, y, label, {
        fontSize: '14px',
        color: saveData ? UI_COLORS.textPrimary : '#666666',
        fontFamily: 'monospace',
        wordWrap: { width: 370 },
      }).setOrigin(0.5);

      if (saveData) {
        slotText.setInteractive({ useHandCursor: true });
        const capturedSlot = slot;
        slotText.on('pointerdown', () => this.loadGame(capturedSlot));
        slotText.on('pointerover', () => slotText.setColor(UI_COLORS.textHighlight));
        slotText.on('pointerout', () => slotText.setColor(UI_COLORS.textPrimary));
        this.menuItems.push(slotText);
      }

      this.panelContainer.add(slotText);
    }

    const backBtn = this.add.text(GAME_WIDTH / 2, 460, '[ Back ]', {
      fontSize: '16px',
      color: UI_COLORS.textSecondary,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.goBack());
    this.panelContainer.add(backBtn);
  }

  private showSettingsScreen(): void {
    this.menuState = 'settings';
    this.clearPanel();

    // Larger panel to fit volume sliders + hotkeys section
    const panelX = GAME_WIDTH / 2 - 250;
    const panelY = 155;
    const panelW = 500;
    const panelH = 420;

    const panel = this.add.graphics();
    panel.fillStyle(UI_COLORS.panelBg, 0.9);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panel.lineStyle(2, UI_COLORS.panelBorder);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    this.panelContainer.add(panel);

    const title = this.add.text(GAME_WIDTH / 2, panelY + 20, 'Settings', {
      fontSize: '28px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.panelContainer.add(title);

    // Volume sliders
    const sliders: [string, keyof Pick<GameSettings, 'masterVolume' | 'musicVolume' | 'sfxVolume'>][] = [
      ['Master Volume', 'masterVolume'],
      ['Music Volume', 'musicVolume'],
      ['SFX Volume', 'sfxVolume'],
    ];

    const sliderStartY = panelY + 60;

    for (let i = 0; i < sliders.length; i++) {
      const [label, key] = sliders[i];
      const y = sliderStartY + i * 45;

      const labelText = this.add.text(panelX + 20, y, label, {
        fontSize: '14px',
        color: UI_COLORS.textSecondary,
        fontFamily: 'monospace',
      });
      this.panelContainer.add(labelText);

      // Slider track
      const track = this.add.graphics();
      track.fillStyle(0x333333);
      track.fillRect(GAME_WIDTH / 2 + 20, y + 4, 180, 8);
      this.panelContainer.add(track);

      // Slider fill
      const fill = this.add.graphics();
      const value = this.settings[key];
      fill.fillStyle(UI_COLORS.xpBar);
      fill.fillRect(GAME_WIDTH / 2 + 20, y + 4, 180 * value, 8);
      this.panelContainer.add(fill);

      // Value text
      const valueText = this.add.text(GAME_WIDTH / 2 + 210, y, `${Math.round(value * 100)}%`, {
        fontSize: '14px',
        color: UI_COLORS.textPrimary,
        fontFamily: 'monospace',
      });
      this.panelContainer.add(valueText);

      // Make track clickable
      const hitZone = this.add.zone(GAME_WIDTH / 2 + 110, y + 8, 180, 20).setInteractive();
      hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const localX = pointer.x - (GAME_WIDTH / 2 + 20);
        const newValue = Phaser.Math.Clamp(localX / 180, 0, 1);
        this.settings[key] = newValue;
        fill.clear();
        fill.fillStyle(UI_COLORS.xpBar);
        fill.fillRect(GAME_WIDTH / 2 + 20, y + 4, 180 * newValue, 8);
        valueText.setText(`${Math.round(newValue * 100)}%`);
        this.saveSettings();
      });
      this.panelContainer.add(hitZone);
    }

    // Divider line
    const dividerY = sliderStartY + sliders.length * 45 + 10;
    const divider = this.add.graphics();
    divider.lineStyle(1, UI_COLORS.panelBorder, 0.5);
    divider.lineBetween(panelX + 20, dividerY, panelX + panelW - 20, dividerY);
    this.panelContainer.add(divider);

    // Hotkeys section
    const hotkeyTitleY = dividerY + 14;
    const hotkeyTitle = this.add.text(GAME_WIDTH / 2, hotkeyTitleY, 'Hotkeys', {
      fontSize: '18px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.panelContainer.add(hotkeyTitle);

    const hotkeys = [
      'WASD / Arrows - Move',
      'E / Space - Interact',
      '1-9 - Hotbar Slots',
      'I - Inventory',
      'M - Monster Party',
      'P - Player Stats',
      'ESC - Menu / Back',
    ];

    // Two-column layout to fit within the panel
    const colWidth = (panelW - 60) / 2;
    const hotkeyStartY = hotkeyTitleY + 28;
    const leftColX = panelX + 30;
    const rightColX = panelX + 30 + colWidth;
    const midpoint = Math.ceil(hotkeys.length / 2);

    for (let i = 0; i < hotkeys.length; i++) {
      const col = i < midpoint ? 0 : 1;
      const row = col === 0 ? i : i - midpoint;
      const x = col === 0 ? leftColX : rightColX;
      const y = hotkeyStartY + row * 20;

      const hkText = this.add.text(x, y, hotkeys[i], {
        fontSize: '11px',
        color: UI_COLORS.textSecondary,
        fontFamily: 'monospace',
      });
      this.panelContainer.add(hkText);
    }

    // Back button — inside the panel
    const backBtnY = panelY + panelH - 30;
    const backBtn = this.add.text(GAME_WIDTH / 2, backBtnY, '[ Back ]', {
      fontSize: '16px',
      color: UI_COLORS.textSecondary,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.goBack());
    this.panelContainer.add(backBtn);
  }

  private showCreditsScreen(): void {
    this.menuState = 'credits';
    this.clearPanel();

    // Panel dimensions
    const panelX = GAME_WIDTH / 2 - 250;
    const panelY = 155;
    const panelW = 500;
    const panelH = 420;

    // Panel background
    const panel = this.add.graphics();
    panel.fillStyle(UI_COLORS.panelBg, 0.9);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panel.lineStyle(2, UI_COLORS.panelBorder);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    this.panelContainer.add(panel);

    // Title (outside scrollable area)
    const title = this.add.text(GAME_WIDTH / 2, panelY + 20, 'Credits', {
      fontSize: '28px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.panelContainer.add(title);

    // Scrollable content area — leave room for title above and back button below
    const contentTop = panelY + 55;
    const contentBottom = panelY + panelH - 45;
    this.creditsViewportHeight = contentBottom - contentTop;
    const innerPad = 8; // breathing room inside the scroll area

    // Create a container positioned at the top of the viewport.
    // Children use LOCAL y coordinates (starting at 0).
    this.creditsContent = this.add.container(0, contentTop);

    const credits = [
      { role: 'Game Designer & Developer', name: 'Garrett Emrick' },
      { role: '', name: 'emrickgarrett@github.com' },
      { role: '', name: '' },
      { role: 'AI Programming Partner', name: 'Claude (Anthropic)' },
      { role: '', name: 'claude.ai' },
      { role: '', name: '' },
      { role: 'Built With', name: '' },
      { role: '', name: 'Phaser 3 - HTML5 Game Framework' },
      { role: '', name: 'TypeScript + Vite' },
      { role: '', name: '' },
      { role: 'Placeholder Art', name: 'Procedurally generated' },
      { role: '', name: '' },
      { role: 'Inspired By', name: '' },
      { role: '', name: 'Stardew Valley' },
      { role: '', name: 'Pokemon' },
      { role: '', name: 'Harvest Moon' },
      { role: '', name: 'Palworld' },
      { role: '', name: '' },
      { role: 'Special Thanks', name: '' },
      { role: '', name: 'You, for playing!' },
    ];

    // Build content using local-y starting with inner padding
    let localY = innerPad;
    for (const credit of credits) {
      if (credit.role) {
        const roleText = this.add.text(GAME_WIDTH / 2, localY, credit.role, {
          fontSize: '14px',
          color: UI_COLORS.textHighlight,
          fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.creditsContent.add(roleText);
        localY += 22;
      }
      if (credit.name) {
        const nameText = this.add.text(GAME_WIDTH / 2, localY, credit.name, {
          fontSize: '12px',
          color: UI_COLORS.textSecondary,
          fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.creditsContent.add(nameText);
        localY += 20;
      } else if (!credit.role) {
        localY += 12;
      }
    }

    // Add bottom padding so the last line isn't clipped
    const totalContentHeight = localY + innerPad;
    this.creditsMaxScroll = Math.max(0, totalContentHeight - this.creditsViewportHeight);

    // Geometry mask so content clips to the viewport region
    const maskShape = this.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(panelX, contentTop, panelW, this.creditsViewportHeight);
    this.creditsMask = maskShape.createGeometryMask();
    this.creditsContent.setMask(this.creditsMask);

    // Scrollbar (only show if content overflows)
    if (this.creditsMaxScroll > 0) {
      const scrollbarX = panelX + panelW - 16;
      const scrollTrackHeight = this.creditsViewportHeight;

      this.scrollTrack = this.add.graphics();
      this.scrollTrack.fillStyle(0x333333, 0.5);
      this.scrollTrack.fillRoundedRect(scrollbarX, contentTop, 8, scrollTrackHeight, 4);
      this.panelContainer.add(this.scrollTrack);

      this.scrollThumb = this.add.graphics();
      this.panelContainer.add(this.scrollThumb);
      this.drawScrollThumb(scrollbarX, contentTop, scrollTrackHeight);

      // Scroll hint text
      const scrollHint = this.add.text(GAME_WIDTH / 2, contentBottom + 4, '↑↓ Scroll', {
        fontSize: '10px',
        color: UI_COLORS.textSecondary,
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.panelContainer.add(scrollHint);
    }

    // Mouse wheel scrolling
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
      if (this.menuState !== 'credits' || this.creditsMaxScroll <= 0) return;
      this.scrollCredits(deltaY > 0 ? 30 : -30);
    });

    // Back button — inside the panel, below the scroll area
    const backBtnY = panelY + panelH - 22;
    const backBtn = this.add.text(GAME_WIDTH / 2, backBtnY, '[ Back ]', {
      fontSize: '16px',
      color: UI_COLORS.textSecondary,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.goBack());
    this.panelContainer.add(backBtn);
  }

  private scrollCredits(delta: number): void {
    if (!this.creditsContent) return;

    this.creditsScrollY = Phaser.Math.Clamp(
      this.creditsScrollY + delta,
      0,
      this.creditsMaxScroll
    );

    // Container base Y is contentTop (panelY + 55 = 210).
    // Scroll by offsetting from that base position.
    const contentTop = 155 + 55; // panelY + header offset
    this.creditsContent.setY(contentTop - this.creditsScrollY);

    // Update scrollbar thumb position
    if (this.scrollThumb) {
      const scrollbarX = GAME_WIDTH / 2 + 250 - 16;  // panelX + panelW - 16
      this.drawScrollThumb(scrollbarX, contentTop, this.creditsViewportHeight);
    }
  }

  private drawScrollThumb(trackX: number, trackTop: number, trackHeight: number): void {
    if (!this.scrollThumb || this.creditsMaxScroll <= 0) return;

    this.scrollThumb.clear();
    const viewportRatio = this.creditsViewportHeight / (this.creditsViewportHeight + this.creditsMaxScroll);
    const thumbHeight = Math.max(20, trackHeight * viewportRatio);
    const scrollRatio = this.creditsScrollY / this.creditsMaxScroll;
    const thumbY = trackTop + scrollRatio * (trackHeight - thumbHeight);

    this.scrollThumb.fillStyle(UI_COLORS.panelBorderLight, 0.8);
    this.scrollThumb.fillRoundedRect(trackX, thumbY, 8, thumbHeight, 4);
  }

  private navigateMenu(direction: number): void {
    // In credits, use up/down for scrolling
    if (this.menuState === 'credits' && this.creditsMaxScroll > 0) {
      this.scrollCredits(direction * 30);
      return;
    }

    if (this.menuItems.length === 0) return;
    this.selectedIndex = (this.selectedIndex + direction + this.menuItems.length) % this.menuItems.length;
    this.updateMenuHighlight();
  }

  private updateMenuHighlight(): void {
    for (let i = 0; i < this.menuItems.length; i++) {
      if (i === this.selectedIndex) {
        this.menuItems[i].setColor(UI_COLORS.textHighlight);
        this.menuItems[i].setScale(1.1);
      } else {
        this.menuItems[i].setColor(UI_COLORS.textPrimary);
        this.menuItems[i].setScale(1.0);
      }
    }
  }

  private selectMenuItem(): void {
    if (this.menuState === 'main') {
      switch (this.selectedIndex) {
        case 0: this.showNewGameScreen(); break;
        case 1: this.showLoadGameScreen(); break;
        case 2: this.showSettingsScreen(); break;
        case 3: this.showCreditsScreen(); break;
      }
    } else if (this.menuState === 'loadGame' && this.menuItems.length > 0) {
      // Find which slot this corresponds to
      this.loadGame(this.selectedIndex);
    }
  }

  private goBack(): void {
    if (this.menuState !== 'main') {
      this.showMainMenu();
    }
  }

  private startNewGame(playerName: string): void {
    const playerData = createDefaultPlayerData(playerName);
    const saveData = createNewSaveData(playerName, playerData);

    // Find first empty slot
    let slot = 0;
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      if (!SaveSystem.loadFromSlot(i)) {
        slot = i;
        break;
      }
    }

    SaveSystem.saveToSlot(slot, saveData);
    this.registry.set('currentSave', saveData);
    this.registry.set('currentSlot', slot);

    this.scene.start(SCENES.WORLD);
  }

  private loadGame(slot: number): void {
    const saveData = SaveSystem.loadFromSlot(slot);
    if (saveData) {
      this.registry.set('currentSave', saveData);
      this.registry.set('currentSlot', slot);
      this.scene.start(SCENES.WORLD);
    }
  }

  private saveSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }
}
