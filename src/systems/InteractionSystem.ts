import { EventBus } from '../utils/EventBus';
import { EVENTS, INTERACTION_RANGE, SCALED_TILE } from '../utils/Constants';

export interface Interactable {
  id: string;
  x: number;
  y: number;
  type: InteractionType;
  data: Record<string, any>;
  onInteract?: (playerX: number, playerY: number) => void;
}

export type InteractionType =
  | 'sign'
  | 'npc'
  | 'door'
  | 'chest'
  | 'crop'
  | 'tree'
  | 'stump'
  | 'rock'
  | 'water'
  | 'shipping_bin'
  | 'mailbox'
  | 'bed'
  | 'worm_spot'
  | 'monster'
  | 'custom';

export interface InteractionResult {
  type: 'dialog' | 'menu' | 'action' | 'battle' | 'locked' | 'none';
  text?: string;
  choices?: string[];
  callback?: (choice?: string) => void;
}

export class InteractionSystem {
  private interactables: Map<string, Interactable> = new Map();
  private bus: EventBus;

  constructor() {
    this.bus = EventBus.getInstance();
  }

  register(interactable: Interactable): void {
    this.interactables.set(interactable.id, interactable);
  }

  unregister(id: string): void {
    this.interactables.delete(id);
  }

  clear(): void {
    this.interactables.clear();
  }

  /** Find the nearest interactable within range of the player */
  findNearest(playerX: number, playerY: number, facingX: number, facingY: number): Interactable | null {
    let nearest: Interactable | null = null;
    let nearestDist = Infinity;

    // The point the player is facing
    const targetX = playerX + facingX * SCALED_TILE;
    const targetY = playerY + facingY * SCALED_TILE;

    for (const interactable of this.interactables.values()) {
      const dx = interactable.x - targetX;
      const dy = interactable.y - targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < INTERACTION_RANGE && dist < nearestDist) {
        nearest = interactable;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  /** Process an interaction with the given interactable */
  interact(interactable: Interactable, playerX: number, playerY: number): InteractionResult {
    if (interactable.onInteract) {
      interactable.onInteract(playerX, playerY);
    }

    switch (interactable.type) {
      case 'sign':
        return {
          type: 'dialog',
          text: interactable.data.text || 'A weathered sign...',
        };

      case 'npc':
        return {
          type: 'dialog',
          text: interactable.data.dialog || 'Hello there!',
          choices: interactable.data.choices,
          callback: interactable.data.onChoice,
        };

      case 'door':
        if (interactable.data.locked) {
          return {
            type: 'locked',
            text: interactable.data.lockedText || 'The door is locked.',
          };
        }
        return {
          type: 'action',
          callback: () => {
            this.bus.emit('door:enter', interactable.data.destination);
          },
        };

      case 'chest':
        return {
          type: 'menu',
          text: 'Storage Chest',
          callback: () => {
            this.bus.emit('chest:open', interactable.id, interactable.data);
          },
        };

      case 'bed':
        return {
          type: 'dialog',
          text: 'Go to sleep for the night?',
          choices: ['Yes', 'No'],
          callback: (choice?: string) => {
            if (choice === 'Yes') {
              this.bus.emit('player:sleep');
            }
          },
        };

      case 'mailbox':
        return {
          type: 'dialog',
          text: interactable.data.mail || 'No new mail.',
        };

      case 'shipping_bin':
        return {
          type: 'dialog',
          text: 'Place items here to sell them overnight.',
        };

      case 'monster':
        return {
          type: 'battle',
          callback: () => {
            this.bus.emit(EVENTS.BATTLE_START, interactable.data);
          },
        };

      default:
        return { type: 'none' };
    }
  }

  getAll(): Interactable[] {
    return Array.from(this.interactables.values());
  }

  getById(id: string): Interactable | undefined {
    return this.interactables.get(id);
  }
}
