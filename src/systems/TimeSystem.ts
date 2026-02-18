import { EventBus } from '../utils/EventBus';
import {
  EVENTS,
  HOURS_PER_DAY,
  WAKE_HOUR,
  MS_PER_GAME_HOUR,
  DAYS_PER_SEASON,
  SEASONS,
  Season,
} from '../utils/Constants';

export interface TimeState {
  hour: number;
  minute: number;
  day: number;
  season: Season;
  year: number;
  isPaused: boolean;
}

export class TimeSystem {
  private state: TimeState;
  private accumulator: number = 0;
  private bus: EventBus;

  /** Real ms per game minute (60 game-minutes = 1 game-hour) */
  private msPerGameMinute: number;

  /** Time speed multiplier (1 = normal, 2 = 2x, etc.). Applied during update(). */
  private timeScale: number = 1;

  constructor(initialState?: Partial<TimeState>) {
    this.bus = EventBus.getInstance();
    this.msPerGameMinute = MS_PER_GAME_HOUR / 60;

    this.state = {
      hour: initialState?.hour ?? WAKE_HOUR,
      minute: initialState?.minute ?? 0,
      day: initialState?.day ?? 1,
      season: initialState?.season ?? 'Spring',
      year: initialState?.year ?? 1,
      isPaused: initialState?.isPaused ?? false,
    };
  }

  update(deltaMs: number): void {
    if (this.state.isPaused) return;

    this.accumulator += deltaMs * this.timeScale;

    while (this.accumulator >= this.msPerGameMinute) {
      this.accumulator -= this.msPerGameMinute;
      this.advanceMinute();
    }
  }

  private advanceMinute(): void {
    const prevHour = this.state.hour;
    this.state.minute++;

    if (this.state.minute >= 60) {
      this.state.minute = 0;
      this.state.hour++;

      if (this.state.hour >= HOURS_PER_DAY) {
        this.state.hour = 0;
      }

      this.bus.emit(EVENTS.HOUR_CHANGED, this.state.hour, prevHour);
    }

    this.bus.emit(EVENTS.TIME_TICK, this.state);
  }

  advanceToNextDay(): void {
    const prevDay = this.state.day;
    this.state.hour = WAKE_HOUR;
    this.state.minute = 0;
    this.state.day++;

    if (this.state.day > DAYS_PER_SEASON) {
      this.state.day = 1;
      this.advanceSeason();
    }

    this.bus.emit(EVENTS.DAY_CHANGED, this.state.day, prevDay);
  }

  private advanceSeason(): void {
    const currentIndex = SEASONS.indexOf(this.state.season);
    const nextIndex = (currentIndex + 1) % SEASONS.length;

    if (nextIndex === 0) {
      this.state.year++;
    }

    const prevSeason = this.state.season;
    this.state.season = SEASONS[nextIndex];
    this.bus.emit(EVENTS.SEASON_CHANGED, this.state.season, prevSeason);
  }

  /** Returns a normalized 0-1 value for the day-night cycle.
   *  0 = midnight, 0.25 = 6am (sunrise), 0.5 = noon, 0.75 = 6pm (sunset), 1 = midnight
   */
  getDayNightProgress(): number {
    return (this.state.hour + this.state.minute / 60) / HOURS_PER_DAY;
  }

  /** Returns the ambient light level (0 = dark, 1 = full light) */
  getAmbientLight(): number {
    const progress = this.getDayNightProgress();

    // Peak brightness at noon (progress = 0.5), darkest at midnight (0 or 1)
    // Smooth sine curve
    const brightness = Math.sin(progress * Math.PI);

    // Clamp minimum brightness so it's never pitch black
    return Math.max(0.25, brightness);
  }

  /** Returns the tint color for the day-night cycle */
  getDayNightTint(): number {
    const progress = this.getDayNightProgress();
    const hour = this.state.hour;

    if (hour >= 6 && hour < 8) {
      // Dawn - warm orange tint
      const t = (hour - 6 + this.state.minute / 60) / 2;
      return this.lerpColor(0x6688cc, 0xffffff, t);
    } else if (hour >= 8 && hour < 17) {
      // Day - no tint
      return 0xffffff;
    } else if (hour >= 17 && hour < 20) {
      // Sunset - warm orange
      const t = (hour - 17 + this.state.minute / 60) / 3;
      return this.lerpColor(0xffffff, 0xffaa66, t);
    } else if (hour >= 20 && hour < 22) {
      // Dusk - getting dark
      const t = (hour - 20 + this.state.minute / 60) / 2;
      return this.lerpColor(0xffaa66, 0x4466aa, t);
    } else {
      // Night
      return 0x4466aa;
    }
  }

  private lerpColor(colorA: number, colorB: number, t: number): number {
    const rA = (colorA >> 16) & 0xff;
    const gA = (colorA >> 8) & 0xff;
    const bA = colorA & 0xff;
    const rB = (colorB >> 16) & 0xff;
    const gB = (colorB >> 8) & 0xff;
    const bB = colorB & 0xff;

    const r = Math.round(rA + (rB - rA) * t);
    const g = Math.round(gA + (gB - gA) * t);
    const b = Math.round(bA + (bB - bA) * t);

    return (r << 16) | (g << 8) | b;
  }

  getFormattedTime(): string {
    const h = this.state.hour % 12 || 12;
    const ampm = this.state.hour < 12 ? 'AM' : 'PM';
    const m = this.state.minute.toString().padStart(2, '0');
    return `${h}:${m} ${ampm}`;
  }

  getFormattedDate(): string {
    return `${this.state.season} ${this.state.day}, Year ${this.state.year}`;
  }

  getState(): TimeState {
    return { ...this.state };
  }

  pause(): void {
    this.state.isPaused = true;
  }

  resume(): void {
    this.state.isPaused = false;
  }

  setTime(hour: number, minute: number): void {
    this.state.hour = hour;
    this.state.minute = minute;
  }

  /** Set time speed multiplier (1 = normal, 2 = 2x, etc.) */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
  }

  /** Get current time speed multiplier */
  getTimeScale(): number {
    return this.timeScale;
  }
}
