# CLAUDE.md - FarmMonsters Project Context

## Project Overview
FarmMonsters is a browser-based game combining Stardew Valley farming with Pokemon monster collecting/battling. Built with Phaser 3 + TypeScript + Vite.

## Current State: Phase 1 Complete
Phase 1 delivers a playable foundation with player movement, farm world, day/night cycle, save/load, hotbar, dialog system, and main menu.

## Architecture

### Core Pattern: EventBus (Observer)
All systems communicate through `src/utils/EventBus.ts` - a typed singleton event emitter. Events are defined in `src/utils/Constants.ts` under the `EVENTS` object. Never reference systems directly; emit events instead.

### Scene Structure
- **BootScene** - Generates all placeholder assets via `AssetGenerator`, creates player animations, transitions to MenuScene
- **MenuScene** - Main menu (New Game, Load, Settings, Credits). Handles name input and save slot selection
- **WorldScene** - Primary gameplay scene. Contains player, farm map, interaction system, time system, HUD overlay, hotbar, dialog box

### Placeholder Assets
All art is procedurally generated at runtime by `src/utils/AssetGenerator.ts`. Every texture uses a string key (e.g., `'player'`, `'tile_grass'`, `'icon_hoe'`). To swap in real art later, just load the same texture key from a file in BootScene instead of generating it.

### Data-Driven Design
Game content will be defined in JSON files under `public/assets/data/`. Currently placeholder - will be populated in later phases.

## File Map

### Config & Entry
- `src/main.ts` - Phaser game bootstrap
- `src/config/GameConfig.ts` - Phaser config (800x600, arcade physics, pixel art)
- `src/utils/Constants.ts` - ALL constants, types, colors, event names

### Scenes (`src/scenes/`)
- `BootScene.ts` - Asset generation + animation creation
- `MenuScene.ts` - Full menu system with 4 screens
- `WorldScene.ts` - Main gameplay (farm map, player, HUD, interactions, day/night)

### Entities (`src/entities/`)
- `Player.ts` - Player sprite with WASD/arrow movement, facing direction, interaction input

### Systems (`src/systems/`)
- `TimeSystem.ts` - Game clock, day/night cycle, seasons (pure logic, no Phaser dependency)
- `SaveSystem.ts` - LocalStorage save/load with 3 slots, versioned schema
- `InteractionSystem.ts` - Registry of interactable objects, handles sign/npc/door/chest/bed/etc

### UI (`src/ui/`)
- `Hotbar.ts` - 9-slot hotbar with keyboard selection (1-9)
- `DialogBox.ts` - Text reveal dialog with choice selection

### Models (`src/models/`)
- `PlayerData.ts` - Player data interface, skills, equipment, stats, XP curve
- `SaveData.ts` - Complete save schema (player, inventory, monsters, time, flags)

### Utils (`src/utils/`)
- `EventBus.ts` - Singleton typed event emitter
- `AssetGenerator.ts` - Procedural pixel art generator
- `Constants.ts` - All game constants and type definitions

## Key Dimensions
- Tile size: 16px, Scale: 3x, Scaled tile: 48px
- Game resolution: 800x600
- Farm map: 40x30 tiles
- Day length: 12 minutes real time = 1 game day

## Type System (8 types)
Fire > Grass > Earth > Water > Fire (primary cycle)
Electric > Water, Dark > Light > Dark (secondary)
Normal: no advantages/weaknesses
Electric immune to Earth attacks

## Upcoming Phases
2. Farming (tools, crops, inventory)
3. Monsters & Combat (battle system, catching, party)
4. Town & NPCs (shops, dialog trees, social)
5. Deep Wilderness & Mines (procedural, trainers, loot)
6. Monster Farm Helpers (automation)
7. Polish (skills, seasons, audio, clothing)

## Testing
Tests live in `tests/` mirroring `src/` structure. Run `npm run test`. Currently testing:
- EventBus (singleton, on/off/once/emit, chaining)
- TimeSystem (time advance, day/season/year cycle, formatting, tints)
- SaveSystem (save/load/delete slots, data integrity)
- PlayerData (defaults, XP curve, skills)

## Important Notes
- All assets are swappable by replacing texture keys in BootScene
- EventBus must be reset in tests via `EventBus.resetInstance()`
- SaveSystem uses `farmmonsters_save_0/1/2` keys in localStorage
- Settings stored at `farmmonsters_settings` key
- Player starts at position (320, 320) on the farm map
