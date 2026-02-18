import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeSystem } from '../../src/systems/TimeSystem';
import { EventBus } from '../../src/utils/EventBus';
import { EVENTS, MS_PER_GAME_HOUR } from '../../src/utils/Constants';

describe('TimeSystem', () => {
  let timeSystem: TimeSystem;
  let bus: EventBus;

  beforeEach(() => {
    EventBus.resetInstance();
    bus = EventBus.getInstance();
    timeSystem = new TimeSystem();
  });

  it('should initialize with default state', () => {
    const state = timeSystem.getState();
    expect(state.hour).toBe(6);
    expect(state.minute).toBe(0);
    expect(state.day).toBe(1);
    expect(state.season).toBe('Spring');
    expect(state.year).toBe(1);
    expect(state.isPaused).toBe(false);
  });

  it('should initialize with custom state', () => {
    const custom = new TimeSystem({ hour: 12, day: 5, season: 'Summer', year: 2 });
    const state = custom.getState();
    expect(state.hour).toBe(12);
    expect(state.day).toBe(5);
    expect(state.season).toBe('Summer');
    expect(state.year).toBe(2);
  });

  it('should advance time on update', () => {
    const msPerMinute = MS_PER_GAME_HOUR / 60;
    timeSystem.update(msPerMinute);
    const state = timeSystem.getState();
    expect(state.minute).toBe(1);
  });

  it('should advance hour when minutes reach 60', () => {
    const msPerMinute = MS_PER_GAME_HOUR / 60;
    const hourCallback = vi.fn();
    bus.on(EVENTS.HOUR_CHANGED, hourCallback);

    // Advance 60 minutes
    timeSystem.update(msPerMinute * 60);

    const state = timeSystem.getState();
    expect(state.hour).toBe(7);
    expect(state.minute).toBe(0);
    expect(hourCallback).toHaveBeenCalledWith(7, 6);
  });

  it('should wrap hours at 24', () => {
    const ts = new TimeSystem({ hour: 23, minute: 59 });
    const msPerMinute = MS_PER_GAME_HOUR / 60;
    ts.update(msPerMinute);
    expect(ts.getState().hour).toBe(0);
  });

  it('should not advance when paused', () => {
    timeSystem.pause();
    const msPerMinute = MS_PER_GAME_HOUR / 60;
    timeSystem.update(msPerMinute * 10);
    expect(timeSystem.getState().minute).toBe(0);
  });

  it('should resume after pause', () => {
    timeSystem.pause();
    timeSystem.resume();
    const msPerMinute = MS_PER_GAME_HOUR / 60;
    timeSystem.update(msPerMinute);
    expect(timeSystem.getState().minute).toBe(1);
  });

  it('should advance to next day', () => {
    const dayCb = vi.fn();
    bus.on(EVENTS.DAY_CHANGED, dayCb);

    timeSystem.advanceToNextDay();
    const state = timeSystem.getState();
    expect(state.day).toBe(2);
    expect(state.hour).toBe(6);
    expect(state.minute).toBe(0);
    expect(dayCb).toHaveBeenCalledWith(2, 1);
  });

  it('should advance season after 28 days', () => {
    const ts = new TimeSystem({ day: 28 });
    const seasonCb = vi.fn();
    bus.on(EVENTS.SEASON_CHANGED, seasonCb);

    ts.advanceToNextDay();
    expect(ts.getState().season).toBe('Summer');
    expect(ts.getState().day).toBe(1);
    expect(seasonCb).toHaveBeenCalledWith('Summer', 'Spring');
  });

  it('should advance year after all seasons', () => {
    const ts = new TimeSystem({ day: 28, season: 'Winter' });
    ts.advanceToNextDay();
    expect(ts.getState().season).toBe('Spring');
    expect(ts.getState().year).toBe(2);
  });

  it('should format time correctly', () => {
    const ts1 = new TimeSystem({ hour: 6, minute: 0 });
    expect(ts1.getFormattedTime()).toBe('6:00 AM');

    const ts2 = new TimeSystem({ hour: 13, minute: 30 });
    expect(ts2.getFormattedTime()).toBe('1:30 PM');

    const ts3 = new TimeSystem({ hour: 0, minute: 5 });
    expect(ts3.getFormattedTime()).toBe('12:05 AM');

    const ts4 = new TimeSystem({ hour: 12, minute: 0 });
    expect(ts4.getFormattedTime()).toBe('12:00 PM');
  });

  it('should format date correctly', () => {
    expect(timeSystem.getFormattedDate()).toBe('Spring 1, Year 1');

    const ts = new TimeSystem({ day: 15, season: 'Fall', year: 3 });
    expect(ts.getFormattedDate()).toBe('Fall 15, Year 3');
  });

  it('should return ambient light values', () => {
    // Noon should be brightest
    const noonTs = new TimeSystem({ hour: 12 });
    expect(noonTs.getAmbientLight()).toBeGreaterThan(0.9);

    // Midnight should be dim but not zero
    const midnightTs = new TimeSystem({ hour: 0 });
    expect(midnightTs.getAmbientLight()).toBeCloseTo(0.25, 1);
  });

  it('should return day/night tint', () => {
    // Daytime should return white
    const dayTs = new TimeSystem({ hour: 12 });
    expect(dayTs.getDayNightTint()).toBe(0xffffff);

    // Night should return blue-ish
    const nightTs = new TimeSystem({ hour: 23 });
    expect(nightTs.getDayNightTint()).toBe(0x4466aa);
  });

  it('should set time directly', () => {
    timeSystem.setTime(15, 30);
    const state = timeSystem.getState();
    expect(state.hour).toBe(15);
    expect(state.minute).toBe(30);
  });

  it('should emit TIME_TICK on every minute advance', () => {
    const tickCb = vi.fn();
    bus.on(EVENTS.TIME_TICK, tickCb);

    const msPerMinute = MS_PER_GAME_HOUR / 60;
    timeSystem.update(msPerMinute * 3);

    expect(tickCb).toHaveBeenCalledTimes(3);
  });
});
