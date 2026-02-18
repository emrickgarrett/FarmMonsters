import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/utils/EventBus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    EventBus.resetInstance();
    bus = EventBus.getInstance();
  });

  it('should be a singleton', () => {
    const bus2 = EventBus.getInstance();
    expect(bus).toBe(bus2);
  });

  it('should emit and receive events', () => {
    const callback = vi.fn();
    bus.on('test', callback);
    bus.emit('test', 'hello');
    expect(callback).toHaveBeenCalledWith('hello');
  });

  it('should handle multiple listeners', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.on('test', cb1);
    bus.on('test', cb2);
    bus.emit('test');
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('should remove specific listener with off', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.on('test', cb1);
    bus.on('test', cb2);
    bus.off('test', cb1);
    bus.emit('test');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('should remove all listeners for an event', () => {
    const cb = vi.fn();
    bus.on('test', cb);
    bus.off('test');
    bus.emit('test');
    expect(cb).not.toHaveBeenCalled();
  });

  it('should handle once listeners', () => {
    const cb = vi.fn();
    bus.once('test', cb);
    bus.emit('test');
    bus.emit('test');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('should pass multiple arguments', () => {
    const cb = vi.fn();
    bus.on('test', cb);
    bus.emit('test', 1, 'two', { three: 3 });
    expect(cb).toHaveBeenCalledWith(1, 'two', { three: 3 });
  });

  it('should call listener with context', () => {
    const context = { value: 42 };
    const cb = vi.fn(function(this: typeof context) {
      return this.value;
    });
    bus.on('test', cb, context);
    bus.emit('test');
    expect(cb).toHaveBeenCalled();
    expect(cb.mock.instances[0]).toBe(context);
  });

  it('should report listener count', () => {
    expect(bus.listenerCount('test')).toBe(0);
    bus.on('test', () => {});
    expect(bus.listenerCount('test')).toBe(1);
    bus.on('test', () => {});
    expect(bus.listenerCount('test')).toBe(2);
  });

  it('should list event names', () => {
    bus.on('alpha', () => {});
    bus.on('beta', () => {});
    expect(bus.eventNames()).toContain('alpha');
    expect(bus.eventNames()).toContain('beta');
  });

  it('should clear all listeners', () => {
    bus.on('a', () => {});
    bus.on('b', () => {});
    bus.removeAll();
    expect(bus.eventNames()).toHaveLength(0);
  });

  it('should not throw when emitting event with no listeners', () => {
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  it('should handle chaining', () => {
    const result = bus.on('test', () => {}).emit('test').off('test');
    expect(result).toBe(bus);
  });
});
