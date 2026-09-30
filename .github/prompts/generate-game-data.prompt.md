---
description: "Generate PlatWorks game data JSON files for one or more Steam games. Scrapes achievement lists, guides, video links, and Reddit community tips."
agent: "agent"
tools: [web, edit, read, search]
---
# Generate Game Data Files

You are a research agent that generates achievement guide data for Steam games.

## Input

The user will provide **one or more game names or Steam App IDs**, separated by commas, newlines, or as a list.

Examples:
- `/generate-game-data "Hollow Knight"`
- `/generate-game-data "Hollow Knight", "Celeste", "Hades"`
- `/generate-game-data 367520, 504230`

## Process

**For each game in the input**, perform these steps sequentially. Complete one game fully before starting the next.

1. **Check if the game already exists** in `src/lib/data/games/`. If `{appId}.json` already exists, skip it and note it was skipped.

2. **Find the Steam App ID** if not provided. Search the Steam store page for the game.

3. **Get the full achievement list.** Use sources like:
   - `https://steamcommunity.com/stats/{appId}/achievements` (official list)
   - `https://www.trueachievements.com` or `https://steamhunters.com`
   - The game's wiki

4. **For each achievement**, research:
   - A clear step-by-step guide (2-5 steps)
   - Whether it's **missable**, **multiplayer-only**, **cumulative**, or **secret**
   - Difficulty rating: `easy`, `medium`, `hard`, or `very-hard`
   - A **video URL** if a good walkthrough exists (YouTube preferred)
   - A **source URL** to the written guide used
   - **Reddit community notes** for tricky achievements — search `site:reddit.com {game name} {achievement name} achievement`
   - **Warnings** for anything missable or with known gotchas

5. **Output a JSON file** at `src/lib/data/games/{appId}.json` following the schema in `src/lib/data/games/schema.json`.

6. **After all games are processed**, run `npm run check` to verify no type errors, then summarize what was generated.

## Schema Reference

Use the types from `src/lib/types/game.ts`:

```typescript
interface GameData {
  appId: number;
  name: string;
  totalAchievements: number;
  achievements: Achievement[];
}

interface Achievement {
  id: string;           // Steam internal achievement ID
  name: string;
  description: string;
  type: 'standard' | 'missable' | 'multiplayer' | 'cumulative' | 'secret';
  difficulty: 'easy' | 'medium' | 'hard' | 'very-hard';
  guide: {
    steps: string[];           // 2-5 clear steps
    videoUrl?: string;         // YouTube or similar
    sourceUrl?: string;        // Written guide URL
    communityNotes?: string[]; // Reddit tips, prefix with "Reddit tip: "
    warnings?: string[];       // Missable alerts, gotchas
  };
}
```

## Rules

- Include `"$schema": "./schema.json"` at the top of the JSON file.
- `totalAchievements` MUST match the length of the `achievements` array.
- Every achievement MUST have at least 2 steps in the guide.
- Mark achievements as `missable` if they can be permanently missed in a single playthrough.
- Mark achievements as `secret` only if the Steam store hides their description.
- Prefix Reddit-sourced notes with `"Reddit tip: "`.
- See `src/lib/data/games/_example.json` for reference.

## Achievement Type Guide

| Type | When to use |
|------|-------------|
| `standard` | Default — can be earned at any time |
| `missable` | Can be permanently missed in a single playthrough (e.g. choices, one-time events) |
| `multiplayer` | Requires online co-op or PvP to earn |
| `cumulative` | Earned over time across multiple sessions (e.g. "kill 1000 enemies") |
| `secret` | Description is hidden on the Steam store page |

## Difficulty Rating Guide

| Rating | Criteria |
|--------|----------|
| `easy` | Earned naturally through normal gameplay, no special effort |
| `medium` | Requires some exploration, grinding, or specific knowledge |
| `hard` | Requires significant effort, skill, or multiple playthroughs |
| `very-hard` | Extreme grind, high skill ceiling, or rare RNG — often < 5% unlock rate |

## Sourcing Priority

1. **Steam Community** — official achievement names and descriptions
2. **TrueAchievements** — verified descriptions and hidden/secret reveals
3. **Game wikis** — detailed guides and strategies
4. **YouTube** — video walkthroughs for boss fights and tricky achievements
5. **Reddit** — community tips for bugged, RNG-heavy, or counterintuitive achievements

## Existing Games

Files already in `src/lib/data/games/`:
- `582010.json` — Monster Hunter: World (100)
- `1245620.json` — Elden Ring (42)
- `1282100.json` — Remnant II (65)
- `1623730.json` — Palworld (75)
- `1903340.json` — Clair Obscur: Expedition 33 (55)
- `2246340.json` — Monster Hunter Wilds (50)
- `2807960.json` — Battlefield 6 (53)
- `2887580.json` — Active Matter (38)
- `3321460.json` — Crimson Desert (34)
- `4126040.json` — Aniimo (64)
- `275850.json` — No Man's Sky (27)
