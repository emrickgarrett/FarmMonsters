# CLAUDE.md - FarmMonsters Project Context

## Project Overview
FarmMonsters is a browser-based game combining Stardew Valley farming with Pokemon monster collecting/battling. Built with Phaser 3 + TypeScript + Vite.

## Current State: Phase 2 Complete
Phase 1 delivered the playable foundation (player movement, farm world, day/night cycle, save/load, hotbar, dialog, main menu). Phase 2 adds the complete farming system with tools, crops, inventory, and farm tile management.

## Architecture

### Core Pattern: EventBus (Observer)
All systems communicate through `src/utils/EventBus.ts` - a typed singleton event emitter. Events are defined in `src/utils/Constants.ts` under the `EVENTS` object. Never reference systems directly; emit events instead.

### Scene Structure
- **BootScene** - Loads JSON data files (items, crops), initializes ItemRegistry, generates placeholder assets via `AssetGenerator`, creates player animations, transitions to MenuScene
- **MenuScene** - Main menu (New Game, Load, Settings, Credits). Handles name input and save slot selection
- **WorldScene** - Primary gameplay scene. Contains player, farm map, farming/inventory/tool systems, interaction system, time system, HUD overlay, hotbar, dialog box, inventory UI

### Data-Driven Design
Game content is defined in JSON files under `public/assets/data/`:
- `items.json` - 16 item definitions (6 tools, 4 seeds, 4 crops, 2 materials)
- `crops.json` - 4 crop definitions (parsnip, potato, tomato, pumpkin) with growth stages, seasons, yields

Items and crops are loaded at boot and indexed by `src/data/ItemRegistry.ts` for fast lookups. Seeds and crops are cross-referenced for planting/harvesting workflows.

### Placeholder Assets
All art is procedurally generated at runtime by `src/utils/AssetGenerator.ts`. Every texture uses a string key (e.g., `'player'`, `'tile_grass'`, `'icon_hoe'`, `'crop_parsnip_2'`). To swap in real art later, just load the same texture key from a file in BootScene instead of generating it.

### Pure-Logic Systems
FarmingSystem, InventorySystem, and ToolSystem have zero Phaser dependencies. They operate on plain data and communicate via EventBus, making them fully testable in Node without mocking Phaser.

## File Map

### Config & Entry
- `src/main.ts` - Phaser game bootstrap
- `src/config/GameConfig.ts` - Phaser config (800x600, arcade physics, pixel art)
- `src/utils/Constants.ts` - ALL constants, types, colors, event names, utility functions

### Data (`src/data/`)
- `ItemRegistry.ts` - Static registry for item/crop definitions with seed-crop cross-referencing

### Models (`src/models/`)
- `ItemData.ts` - ItemDefinition interface (id, name, category, toolType, cropId, stackable, etc.)
- `CropData.ts` - CropDefinition interface (growth stages, seasons, yields, regrow settings)
- `PlayerData.ts` - Player data interface, skills, equipment, stats, XP curve
- `SaveData.ts` - Complete save schema v2 (player, inventory, farmTiles, chests, shippingBin, monsters, time, flags)

### Scenes (`src/scenes/`)
- `BootScene.ts` - JSON data loading, asset generation, animation creation
- `MenuScene.ts` - Full menu system with 4 screens (scrollable credits, two-column settings)
- `WorldScene.ts` - Main gameplay: farm map, player, farming integration, HUD, interactions, day/night

### Entities (`src/entities/`)
- `Player.ts` - Player sprite with WASD/arrow movement, facing direction, interaction input

### Systems (`src/systems/`)
- `FarmingSystem.ts` - Pure-logic farming: till/plant/water/harvest/digUp/onNewDay, season validation, regrow support
- `InventorySystem.ts` - Pure-logic inventory with stacking, 27-slot capacity, category filtering
- `ToolSystem.ts` - Coordinates tool usage: energy costs, farming routing, seed planting, harvesting
- `TimeSystem.ts` - Game clock, day/night cycle, seasons (pure logic)
- `SaveSystem.ts` - LocalStorage save/load with 3 slots, versioned schema with v1->v2 migration
- `InteractionSystem.ts` - Registry of interactable objects, handles sign/npc/door/chest/bed/etc

### UI (`src/ui/`)
- `Hotbar.ts` - 9-slot hotbar with keyboard selection (1-9), dynamic icon lookup via ItemRegistry
- `DialogBox.ts` - Dynamic-height text reveal dialog with choice selection
- `InventoryUI.ts` - Grid-based inventory overlay (3x9 grid), tooltips, item icons, toggle with I key

### Utils (`src/utils/`)
- `EventBus.ts` - Singleton typed event emitter
- `AssetGenerator.ts` - Procedural pixel art generator (player, tiles, UI, farming assets)
- `Constants.ts` - All game constants, types, utility functions (pixelToGrid, gridToPixel)

### Data Files (`public/assets/data/`)
- `items.json` - All item definitions (tools, seeds, crops, materials)
- `crops.json` - Crop growth definitions (parsnip, potato, tomato, pumpkin)

## Key Dimensions
- Tile size: 16px, Scale: 3x, Scaled tile: 48px
- Game resolution: 800x600
- Farm map: 40x30 tiles
- Farm area: tiles (8,8) to (23,21) inclusive
- Inventory: 27 slots (3 rows x 9 columns)
- Day length: 12 minutes real time = 1 game day

## Depth System
- GROUND: 0 (terrain tiles)
- GROUND_OVERLAY: 1 (tilled/watered soil overlays)
- World objects: Y-based (~48-1440, sprite.y each frame)
- DAY_NIGHT: 5000 (tint overlay)
- HUD_BG: 5100 (HUD panels)
- HUD_TEXT: 5200 (HUD text)
- HOTBAR: 5300
- DIALOG: 5400
- NOTIFICATION: 5500
- OVERLAY_UI: 5600 (inventory UI)

## Farming System Details

### Crop Lifecycle
1. **Till** (Hoe) - Creates tilled soil on dirt tiles within farm area
2. **Plant** (Seeds) - Places crop on tilled soil, validates season
3. **Water** (Watering Can) - Waters soil; crops only grow if watered
4. **Grow** (onNewDay) - Watered crops advance 1 day of growth; watering resets daily
5. **Harvest** (bare hands on grown crops) - Yields crop items, grants XP
6. **Regrow** (tomato) - Some crops reset to partial growth instead of clearing

### Energy System
Each tool action costs energy (Hoe: 4, WateringCan: 2, Axe: 6, Shovel: 4, FishingRod: 8, Pickaxe: 6). Energy restores to max on sleep.

### Seasons & Crops
- Spring: Parsnip (4 days), Potato (6 days)
- Summer: Tomato (10 days, regrows every 3 days)
- Fall: Pumpkin (12 days)
- Crops planted out of season wither on season change

### Save Schema (v2)
Added `chests`, `shippingBin`, `daysGrown`, `seasonPlanted`, `withered` state to FarmTile. Migration from v1 handled in SaveSystem.

## Type System (8 types)
Fire > Grass > Earth > Water > Fire (primary cycle)
Electric > Water, Dark > Light > Dark (secondary)
Normal: no advantages/weaknesses
Electric immune to Earth attacks

## Upcoming Phases
3. Monsters & Combat (battle system, catching, party)
4. Town & NPCs (shops, dialog trees, social)
5. Deep Wilderness & Mines (procedural, trainers, loot)
6. Monster Farm Helpers (automation)
7. Polish (skills, seasons, audio, clothing)

## Testing
Tests live in `tests/` mirroring `src/` structure. Run `npm run test`. 140 tests across 8 test files:
- EventBus (singleton, on/off/once/emit, chaining)
- TimeSystem (time advance, day/season/year cycle, formatting, tints)
- SaveSystem (save/load/delete slots, data integrity)
- PlayerData (defaults, XP curve, skills)
- ItemRegistry (load items/crops, cross-references, reset)
- InventorySystem (add/remove/stack/serialize, capacity, events)
- FarmingSystem (till/plant/water/harvest/dig, onNewDay, season validation, serialization)
- ToolSystem (tool routing, energy costs, seed planting, harvest, error messages)

## Important Notes
- All assets are swappable by replacing texture keys in BootScene
- EventBus must be reset in tests via `EventBus.resetInstance()`
- ItemRegistry must be reset in tests via `ItemRegistry.reset()`
- SaveSystem uses `farmmonsters_save_0/1/2` keys in localStorage
- Settings stored at `farmmonsters_settings` key
- Player starts at position (320, 320) on the farm map
- Save schema version 2 — migration from v1 adds chests, shippingBin, daysGrown fields
- FarmingSystem, InventorySystem, ToolSystem are pure-logic (no Phaser dependency) for testability
- Crop textures follow pattern: `crop_{cropId}_{stage}` (e.g., `crop_parsnip_2`)
- Item icons follow pattern: `icon_{type}_{id}` (e.g., `icon_seed_parsnip`, `icon_crop_parsnip`)
