# FarmMonsters

**Grow Crops. Catch Monsters. Save the Farm.**

FarmMonsters is a cozy browser-based game that blends the heartwarming farming of *Stardew Valley* with the thrill of monster collecting from *Pokemon*. Tend your crops by day, battle wild creatures by night, and build a team of loyal monsters to help automate your farm!

## What Makes FarmMonsters Special?

In FarmMonsters, the monsters you catch aren't just for battling - they're your farmhands! Assign a **Cow Monster** to plow your fields and produce milk. Let your **Water Sprite** keep crops watered while you explore. Send a **Grass Elemental** to harvest ripe crops and store them in your chests. Your **Fire Drake** can clear stumps and even cook meals!

The deeper you venture into **The Deep Wilderness** and **The Deep Mines**, the stronger monsters and trainers you'll encounter - and the better loot you'll find. These procedurally generated areas are endless, so there's always a new challenge waiting.

## Features

- **Farming** - Till, plant, water, and harvest crops across the seasons
- **Monster Collecting** - Catch and train monsters with 8 elemental types
- **Turn-Based Combat** - Pokemon-style battles with type advantages and strategy
- **Farm Automation** - Assign monsters to farm tasks based on their type
- **Skills System** - Level up Mining, Fishing, Harvesting, Woodcutting, Social, and Battle skills
- **Day/Night Cycle** - Watch the world change from dawn to dusk
- **NPC Town** - Shop, socialize, and take on quests
- **Procedural Dungeons** - Explore endlessly generated wilderness and mines
- **Equipment & Clothing** - Find gear that changes your stats and appearance

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

The game will open in your browser at `http://localhost:3000`.

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrow Keys | Move |
| E / Space | Interact |
| 1-9 | Select hotbar slot |
| I | Open inventory |
| M | Monster party |
| P | Player stats |
| ESC | Pause menu |

## Project Structure

```
FarmMonsters/
├── src/
│   ├── main.ts           # Game entry point
│   ├── config/            # Game configuration
│   ├── scenes/            # Phaser scenes (Boot, Menu, World, Battle)
│   ├── entities/          # Game entities (Player, NPCs, Monsters)
│   ├── systems/           # Game systems (Farming, Combat, Time, Save)
│   ├── combat/            # Battle system (state machine, damage, types)
│   ├── ui/                # UI components (Hotbar, Dialog, Menus)
│   ├── models/            # Data models (Monsters, Items, Saves)
│   ├── world/             # World generation (Maps, Procedural areas)
│   └── utils/             # Utilities (EventBus, Constants, Assets)
├── tests/                 # Unit tests
├── public/assets/         # Game assets (sprites, tilesets, audio, data)
├── CLAUDE.md              # AI development context
└── PROMPTS.md             # Prompt history log
```

## Tech Stack

- **Phaser 3** - HTML5 game framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tooling
- **Vitest** - Unit testing
- **LocalStorage** - Save game persistence

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Foundation | Done | Core engine, movement, world, menu, save/load |
| 2. Farming | Planned | Crop system, tools, inventory |
| 3. Monsters & Combat | Planned | Battle system, catching, party management |
| 4. Town & NPCs | Planned | Shops, dialog, social system |
| 5. Wilderness & Mines | Planned | Procedural generation, trainers, loot |
| 6. Farm Helpers | Planned | Monster farm automation |
| 7. Polish | Planned | Skills, seasons, audio, clothing |

## Credits

- **Garrett Emrick** - Game Designer & Developer ([emrickgarrett@github.com](mailto:emrickgarrett@github.com))
- **Claude (Anthropic)** - AI Programming Partner
- **Phaser 3** - HTML5 Game Framework
- Inspired by *Stardew Valley*, *Pokemon*, *Harvest Moon*, and *Palworld*

## License

MIT
