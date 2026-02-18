# FarmMonsters - Prompt Log

All prompts from the project creator are logged here with timestamps.

---

## Prompt 1 — 2026-02-17

> Hello Claude, today you are an expert Game Programmer and Game Designer, who specializes in cozy farm simulation games and turn based RPG monster tamer games like Pokemon.
>
> Today, you are going to design and create a video game that will run in a web browser that is a mix of Stardew Valley and Pokemon called FarmMonsters. You will create or source your own assets online for monsters, crops, buildings, npcs, and UI, and have them flexible enough to be changed later. For example, if a monster sprite is created, it should be able to be easily swapped out at a future date should this project go into production.
>
> The UI should be themed closer to Harvest moon or Stardew Valley, and consistent UI theming throughout. The user should have a hotbar (1-9 hotkeys) that allows them to equip various items in the world, and eat food they collect or make on their adventure. They also need a pokemon like screen where they can view/assemble their fighting roster, and have the ability to give them items to hold, feed them items, and the ability to be shuffled around and have stats viewed just like pokemon.
>
> The UI should also have a window where the player can view their player stats (battles won, creatures collected, unique creatures collected, skills), their portrait, and equipped items. The player should be able to equip clothes they find in the world that change their appearance, and can change their skills. The skills system should work similar to Stardew Valley where they have a mining, fishing, harvesting, woodcutting, social, and battle skills that can all be grinded for xp to improve and select level up effects at night when they sleep.
>
> The world needs a UI for interaction with options to allow the user to interact and navigate. They should be able to read signs, acknowledge interactions/locked doors, and enter battles/combat similar to pokemon and stardew valley. This needs to be scalable and flexible for future interactions and updates to the system, and should be as re-usable as possible.
>
> The combat system should be nearly identical to Pokemon.
>
> The farming, exploration, resource gathering, and npc systems should be nearly identical to Stardew Valley. The user needs to be able to navigate the world and interact with it in this way. They should start on a farm with a house, and a few fields where they can plant and raise crops, trees, and use various tools to improve the land. A hoe to till fields to plant crops, a water bucket to water crops so they can grow. An axe to cut down trees left on the land and in other areas of the world for wood, a shovel to dig up stumps for wood in the world and to search for worms or hidden goods. A fishing rod to fish for both fish to eat, and monsters to collect (using worms for better monster chances).
>
> However, the twist will be the user being able to assign monsters to help them run the farm and produce goods. A Cows monster will be monsters that will help plow the fields and produce fertilizer, while also being able to produce milk. Certain water monsters will be able to water crops for the user. Grass type monsters will be able to harvest crops and put them in the nearest storage chest the user has placed. Fire type monsters can cook and remove stumps on the land. etc, etc. Get creative with some examples here, take inspiration from Palworld.
>
> NPC's need to populate the world both in the local town where they run shops/stores and interact with the player, but also in an area called "The Deep Wilderness" and "The Deep Mines" where they will battle the player and their monster party. These areas should also contain loot and equipment for the player to encourage training there and strengthening their party to go deeper. If this could be randomly generated and endless, that would be ideal. The trainers in this area should be able to wander around randomly, looking for players. There should also be monsters roaming the area the player can encounter and catch, similar to Pokemon or PalWorld
>
> The very beginning of the game should be a menu screen where the user can Start a New Game, Load a Game, View their settings (Show Hotkeys for the game, adjust music/sound/master sound volume levels), and view the credits of the project which will include Me (Garrett Emrick @ emrickgarrett@github.com), Yourself, and any art you use from online.
>
> Lastly this is a test project I am doing for work, and I would like every prompt from me to be recorded in a PROMPTS.md file in this project, and to be timestamped. I would also like you to keep a CLAUDE.md file for your personal and future use to ensure you thoroughly understand the project context going forward, and keep it updated with changes you make and the file structure/context of the project. If a subdirectory of files is complex or the context is high, please feel free to create more CLAUDE.md files to help future you and subagents with additional details. Please also created a README.md file that explains the project in a fun way for human users, including basic information about the project and project structure. Write tests throughout the process to ensure you have a solid foundation for future growth.
>
> Take your time and feel free to ask questions. Be thoughtful and creative.

---

## Prompt 2 — 2026-02-17

> One bug I found is that when interacting with an object and the UI menu pops up after I press interact, the window comes up again when I press the interact button so I can never move

---

## Prompt 3 — 2026-02-17

> That fixed. Another thing I'm noticing is that the player rightfully clips over objects when in front of them, but is unable to go behind objects. It looks strange on things like trees where the player character walks over them. Is this going to be fixed in a future version, or can we adjust for this now so the world has depth that makes sense?

---

## Prompt 4 — 2026-02-17

> Mostly looks good, although I think the collision boxes for most of the objects in the scene are now broken. The rocks/stumps you can entirely walk through but not one tile below, and the trees are wrong too. The house collision also seems broke, probably some other objects as well

---

## Prompt 5 — 2026-02-17

> Looks good, however the player character still appears above sprites when he should go behind them, such as trees and the house.

---

## Prompt 6 — 2026-02-17

> Now the Hotbar seems to draw under all objects, UI elements should always show on top

---

## Prompt 7 — 2026-02-17

> Thanks, the Credits screen doesn't seem to wrap the text, it goes below the containing box and looks terrible. The in game pause UI as well for saving/settings/credits also overflows the UI element box you created and looks bad as well. The container should be able to hold all elements. For the Credits screen on the start menu, we can implement scrolling in the window if it's too large

---

## Prompt 8 — 2026-02-17

> The padding on the credits screen within the scroll is off and it's cut off on both the top and bottom, making it unreadable at the top and bottom

---

## Prompt 9 — 2026-02-17

> Looks good, can we git commit this to a branch, and point it at: https://github.com/emrickgarrett/FarmMonsters.git Then create the MR and I'll review it shortly while you go to phase 2 of the plan

---

## Prompt 10 — 2026-02-17

> I have a list of bugs for you to fix, take them one at a time and work on them carefully.
>
> 1. Having an item equipped makes you unable to interact with objects, such as signs. Interactions should take priority.
> 2. I have no way to equip the seeds from the inventory. I believe we should have the hotbar still be visible and allow the player to drag items to appropriate slots for them to use, such as the seeds.
> 3. I can till under rocks/stumps, that should not be possible until the object is removed. I also think the rocks and stumps are slightly too small relative to their collision box, making it distracting when navigating the farm as a player

---

## Prompt 11 — 2026-02-17

> I noticed I am still able to till the ground and plant crops under stumps and rocks, it seems like you are only accounting for the bottom right tile of the collision box, and not the entire sprite and collider.
>
> I would also like some debugging tools when in the dev environment to allow me to speed up time, so I can properly QA and verify your work
