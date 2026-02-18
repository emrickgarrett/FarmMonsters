import Phaser from 'phaser';
import { PLAYER_SPEED, SCALE, TILE_SIZE, EVENTS, SCALED_TILE } from '../utils/Constants';
import { EventBus } from '../utils/EventBus';

export type Direction = 'up' | 'down' | 'left' | 'right';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private bus: EventBus;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private interactKey!: Phaser.Input.Keyboard.Key;
  private interactKeyE!: Phaser.Input.Keyboard.Key;

  public facing: Direction = 'down';
  public isInteracting: boolean = false;
  public canMove: boolean = true;
  /** Timestamp of last unfreeze - prevents immediate re-interaction after dialog closes */
  private unfreezeTime: number = 0;
  private static readonly INTERACT_COOLDOWN_MS = 200;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player', 0);

    this.bus = EventBus.getInstance();

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Setup physics body
    this.setScale(SCALE);
    this.setOrigin(0.5, 1); // Bottom-center origin for Y-based depth sorting
    this.setSize(10, 10);
    this.setOffset(3, 6);
    this.setCollideWorldBounds(true);

    // Setup input
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.interactKeyE = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Play idle animation
    this.play('player_idle_down');
  }

  update(): void {
    if (!this.canMove || this.isInteracting) {
      this.setVelocity(0, 0);
      this.play(`player_idle_${this.facing}`, true);
      return;
    }

    this.handleMovement();
    this.handleInteraction();
  }

  private handleMovement(): void {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    let vx = 0;
    let vy = 0;

    if (left) { vx = -1; this.facing = 'left'; }
    else if (right) { vx = 1; this.facing = 'right'; }

    if (up) { vy = -1; this.facing = 'up'; }
    else if (down) { vy = 1; this.facing = 'down'; }

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const factor = Math.SQRT1_2;
      vx *= factor;
      vy *= factor;
    }

    this.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    if (vx !== 0 || vy !== 0) {
      this.play(`player_walk_${this.facing}`, true);
      this.bus.emit(EVENTS.PLAYER_MOVED, this.x, this.y, this.facing);
    } else {
      this.play(`player_idle_${this.facing}`, true);
    }
  }

  private handleInteraction(): void {
    // Don't allow interaction immediately after unfreezing (e.g. dialog just closed)
    if (Date.now() - this.unfreezeTime < Player.INTERACT_COOLDOWN_MS) return;

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        Phaser.Input.Keyboard.JustDown(this.interactKeyE)) {
      const facingDir = this.getFacingVector();
      this.bus.emit(EVENTS.PLAYER_INTERACT, this.x, this.y, facingDir.x, facingDir.y);
    }
  }

  getFacingVector(): { x: number; y: number } {
    switch (this.facing) {
      case 'up': return { x: 0, y: -1 };
      case 'down': return { x: 0, y: 1 };
      case 'left': return { x: -1, y: 0 };
      case 'right': return { x: 1, y: 0 };
    }
  }

  /** Get the world position of the tile the player is facing */
  getFacingTilePosition(): { x: number; y: number } {
    const facing = this.getFacingVector();
    return {
      x: this.x + facing.x * SCALED_TILE,
      y: this.y + facing.y * SCALED_TILE,
    };
  }

  freeze(): void {
    this.canMove = false;
    this.setVelocity(0, 0);
    this.play(`player_idle_${this.facing}`, true);
  }

  unfreeze(): void {
    this.canMove = true;
    this.unfreezeTime = Date.now();
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  setFacing(direction: Direction): void {
    this.facing = direction;
    this.play(`player_idle_${this.facing}`, true);
  }
}
