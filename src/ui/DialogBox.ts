import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UI_COLORS, EVENTS } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

export interface DialogConfig {
  text: string;
  choices?: string[];
  callback?: (choice?: string) => void;
  speakerName?: string;
}

export class DialogBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private nameTag: Phaser.GameObjects.Text;
  private textDisplay: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private promptText: Phaser.GameObjects.Text;
  private bus: EventBus;

  private isVisible: boolean = false;
  private currentConfig: DialogConfig | null = null;
  private selectedChoice: number = 0;
  private textRevealed: boolean = false;
  private revealIndex: number = 0;
  private revealTimer: Phaser.Time.TimerEvent | null = null;
  private fullText: string = '';
  /** Timestamp when dialog was shown - ignores input during cooldown to prevent
   *  the same keypress that opened the dialog from also advancing/closing it. */
  private showTime: number = 0;
  private static readonly INPUT_COOLDOWN_MS = 200;

  // Dialog layout constants
  private readonly boxWidth = GAME_WIDTH - 40;
  private readonly boxX = 20;
  private readonly padding = 16;
  private readonly choiceLineHeight = 22;
  private readonly minBoxHeight = 80;
  private readonly maxBoxHeight = 280;

  // Dynamic — recalculated per show()
  private boxHeight = 120;
  private boxY = GAME_HEIGHT - 140;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bus = EventBus.getInstance();

    this.container = scene.add.container(0, 0).setDepth(5400).setVisible(false);

    // Background panel
    this.background = scene.add.graphics();
    this.container.add(this.background);

    // Speaker name tag
    this.nameTag = scene.add.text(0, 0, '', {
      fontSize: '14px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
      backgroundColor: `#${UI_COLORS.dialogBg.toString(16)}`,
      padding: { x: 6, y: 2 },
    });
    this.container.add(this.nameTag);

    // Main text
    this.textDisplay = scene.add.text(0, 0, '', {
      fontSize: '14px',
      color: UI_COLORS.textPrimary,
      fontFamily: 'monospace',
      wordWrap: { width: this.boxWidth - this.padding * 2 },
      lineSpacing: 4,
    });
    this.container.add(this.textDisplay);

    // Continue prompt
    this.promptText = scene.add.text(0, 0, '>>', {
      fontSize: '12px',
      color: UI_COLORS.textHighlight,
      fontFamily: 'monospace',
    });
    this.container.add(this.promptText);

    // Blinking animation for prompt
    scene.tweens.add({
      targets: this.promptText,
      alpha: { from: 1, to: 0.3 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Input handling
    this.setupInput();

    // Set scroll factor to 0 so dialog stays on screen
    this.container.setScrollFactor(0);
  }

  /**
   * Measure the required box height for the given text + choices, then
   * reposition all child elements accordingly.
   */
  private layoutBox(config: DialogConfig): void {
    // Measure text height by temporarily setting the full text on the display
    this.textDisplay.setText(config.text);
    const textHeight = this.textDisplay.height;
    this.textDisplay.setText(''); // will be filled by reveal animation

    // Calculate choices height
    const numChoices = config.choices?.length ?? 0;
    const choicesHeight = numChoices > 0
      ? numChoices * this.choiceLineHeight + 8 // 8px gap between text and choices
      : 0;

    // Total inner height: padding-top + text + gap + choices + padding-bottom
    const innerHeight = this.padding + textHeight + choicesHeight + this.padding;

    // Clamp box height
    this.boxHeight = Phaser.Math.Clamp(innerHeight, this.minBoxHeight, this.maxBoxHeight);

    // Position box at the bottom of the screen
    this.boxY = GAME_HEIGHT - this.boxHeight - 20;

    // Reposition elements
    this.nameTag.setPosition(this.boxX + this.padding, this.boxY - 20);
    this.textDisplay.setPosition(this.boxX + this.padding, this.boxY + this.padding);
    this.promptText.setPosition(
      this.boxX + this.boxWidth - this.padding - 10,
      this.boxY + this.boxHeight - this.padding - 5
    );

    // Redraw background
    this.drawBackground();
  }

  private drawBackground(): void {
    this.background.clear();

    // Outer border
    this.background.fillStyle(UI_COLORS.dialogBorder, 1);
    this.background.fillRoundedRect(this.boxX - 2, this.boxY - 2, this.boxWidth + 4, this.boxHeight + 4, 6);

    // Inner background
    this.background.fillStyle(UI_COLORS.dialogBg, 0.95);
    this.background.fillRoundedRect(this.boxX, this.boxY, this.boxWidth, this.boxHeight, 4);

    // Inner border highlight
    this.background.lineStyle(1, UI_COLORS.panelBorderLight, 0.3);
    this.background.strokeRoundedRect(this.boxX + 2, this.boxY + 2, this.boxWidth - 4, this.boxHeight - 4, 3);
  }

  private setupInput(): void {
    this.scene.input.keyboard!.on('keydown-SPACE', () => this.handleAdvance());
    this.scene.input.keyboard!.on('keydown-E', () => this.handleAdvance());
    this.scene.input.keyboard!.on('keydown-ENTER', () => this.handleAdvance());
    this.scene.input.keyboard!.on('keydown-UP', () => this.navigateChoice(-1));
    this.scene.input.keyboard!.on('keydown-DOWN', () => this.navigateChoice(1));
    this.scene.input.keyboard!.on('keydown-W', () => this.navigateChoice(-1));
    this.scene.input.keyboard!.on('keydown-S', () => this.navigateChoice(1));
  }

  show(config: DialogConfig): void {
    this.currentConfig = config;
    this.isVisible = true;
    this.textRevealed = false;
    this.revealIndex = 0;
    this.fullText = config.text;
    this.selectedChoice = 0;
    this.showTime = Date.now();

    // Measure content and size/position the box
    this.layoutBox(config);

    this.container.setVisible(true);

    // Set speaker name
    if (config.speakerName) {
      this.nameTag.setText(config.speakerName);
      this.nameTag.setVisible(true);
    } else {
      this.nameTag.setVisible(false);
    }

    // Clear choices
    this.clearChoices();

    // Start text reveal
    this.textDisplay.setText('');
    this.promptText.setVisible(false);

    this.revealTimer = this.scene.time.addEvent({
      delay: 30,
      repeat: this.fullText.length - 1,
      callback: () => {
        this.revealIndex++;
        this.textDisplay.setText(this.fullText.substring(0, this.revealIndex));

        if (this.revealIndex >= this.fullText.length) {
          this.onTextFullyRevealed();
        }
      },
    });

    this.bus.emit(EVENTS.DIALOG_OPEN);
  }

  private onTextFullyRevealed(): void {
    this.textRevealed = true;

    if (this.currentConfig?.choices && this.currentConfig.choices.length > 0) {
      this.showChoices(this.currentConfig.choices);
      this.promptText.setVisible(false);
    } else {
      this.promptText.setVisible(true);
    }
  }

  private showChoices(choices: string[]): void {
    this.clearChoices();

    // Place choices after the text, with a small gap
    const textBottom = this.textDisplay.y + this.textDisplay.height;
    const startY = textBottom + 8;

    for (let i = 0; i < choices.length; i++) {
      const prefix = i === this.selectedChoice ? '> ' : '  ';
      const text = this.scene.add.text(
        this.boxX + this.padding + 20,
        startY + i * this.choiceLineHeight,
        `${prefix}${choices[i]}`,
        {
          fontSize: '14px',
          color: i === this.selectedChoice ? UI_COLORS.textHighlight : UI_COLORS.textPrimary,
          fontFamily: 'monospace',
        }
      );
      text.setScrollFactor(0);
      this.choiceTexts.push(text);
      this.container.add(text);
    }
  }

  private clearChoices(): void {
    for (const t of this.choiceTexts) {
      t.destroy();
    }
    this.choiceTexts = [];
  }

  private navigateChoice(direction: number): void {
    if (!this.isVisible || !this.textRevealed || !this.currentConfig?.choices) return;

    const choices = this.currentConfig.choices;
    this.selectedChoice = (this.selectedChoice + direction + choices.length) % choices.length;

    for (let i = 0; i < this.choiceTexts.length; i++) {
      const prefix = i === this.selectedChoice ? '> ' : '  ';
      this.choiceTexts[i].setText(`${prefix}${choices[i]}`);
      this.choiceTexts[i].setColor(
        i === this.selectedChoice ? UI_COLORS.textHighlight : UI_COLORS.textPrimary
      );
    }
  }

  private handleAdvance(): void {
    if (!this.isVisible) return;

    // Ignore input during cooldown to prevent the keypress that opened the
    // dialog from also advancing or closing it in the same frame.
    if (Date.now() - this.showTime < DialogBox.INPUT_COOLDOWN_MS) return;

    if (!this.textRevealed) {
      // Skip to full text
      if (this.revealTimer) {
        this.revealTimer.remove();
        this.revealTimer = null;
      }
      this.revealIndex = this.fullText.length;
      this.textDisplay.setText(this.fullText);
      this.onTextFullyRevealed();
      return;
    }

    // If there are choices, select the current one
    if (this.currentConfig?.choices && this.currentConfig.choices.length > 0) {
      const selectedText = this.currentConfig.choices[this.selectedChoice];
      if (this.currentConfig.callback) {
        this.currentConfig.callback(selectedText);
      }
      this.bus.emit(EVENTS.DIALOG_CHOICE, selectedText, this.selectedChoice);
    } else if (this.currentConfig?.callback) {
      this.currentConfig.callback();
    }

    this.hide();
  }

  hide(): void {
    this.isVisible = false;
    this.container.setVisible(false);
    this.currentConfig = null;
    this.clearChoices();

    if (this.revealTimer) {
      this.revealTimer.remove();
      this.revealTimer = null;
    }

    this.bus.emit(EVENTS.DIALOG_CLOSE);
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  destroy(): void {
    this.container.destroy();
  }
}
