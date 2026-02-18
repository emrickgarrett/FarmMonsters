type EventCallback = (...args: any[]) => void;

interface EventEntry {
  callback: EventCallback;
  context?: object;
  once: boolean;
}

/**
 * Typed singleton event emitter for decoupling game systems.
 * All scenes and systems communicate through this bus.
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, EventEntry[]> = new Map();

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /** Reset for testing */
  static resetInstance(): void {
    EventBus.instance = new EventBus();
  }

  on(event: string, callback: EventCallback, context?: object): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ callback, context, once: false });
    return this;
  }

  once(event: string, callback: EventCallback, context?: object): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ callback, context, once: true });
    return this;
  }

  off(event: string, callback?: EventCallback, context?: object): this {
    if (!callback) {
      this.listeners.delete(event);
      return this;
    }

    const entries = this.listeners.get(event);
    if (!entries) return this;

    const filtered = entries.filter(
      (e) => e.callback !== callback || (context && e.context !== context)
    );

    if (filtered.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, filtered);
    }
    return this;
  }

  emit(event: string, ...args: any[]): this {
    const entries = this.listeners.get(event);
    if (!entries) return this;

    const toRemove: EventEntry[] = [];

    for (const entry of entries) {
      if (entry.context) {
        entry.callback.apply(entry.context, args);
      } else {
        entry.callback(...args);
      }
      if (entry.once) {
        toRemove.push(entry);
      }
    }

    if (toRemove.length > 0) {
      const remaining = entries.filter((e) => !toRemove.includes(e));
      if (remaining.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, remaining);
      }
    }

    return this;
  }

  removeAll(): this {
    this.listeners.clear();
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}
