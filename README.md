# PlatWorks

The ultimate completionist companion for Steam gamers. Break down Steam achievements into step-by-step guides, missable alerts, and progress tracking — all in a mobile-first, 60fps interface.

## Features

- **Achievement guides** — step-by-step instructions, video links, Reddit community tips, and missable warnings for every trophy
- **Progress tracking** — manually check off achievements or sync with any public Steam profile
- **No API key required** — syncs via public Steam community XML endpoints (profile must be public)
- **Steam account in navbar** — set your Steam ID/vanity/URL once, syncs across all pages
- **Sync all games** — one button on the home page syncs every incomplete game at once
- **Search, sort, filter** — search games by name, sort by A–Z / completion / recently played, filter achievements by type and difficulty
- **Mobile-first UI** — fixed bottom bar with sync/search/filter/scroll, sticky filters, breadcrumb navbar
- **60fps animations** — View Transitions API for page slides, CSS grid-rows expand/collapse, GPU-only transforms
- **AI-powered data generation** — use `/generate-game-data` to scrape and build achievement guides for any Steam game (supports multiple games at once)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit + Svelte 5 (Runes: `$state`, `$derived`, `$props`, `$effect`) |
| Styling | Tailwind CSS v4 with custom Steam color theme |
| Icons | @lucide/svelte |
| Type Safety | TypeScript (strict) |
| API | Steam public XML endpoints (no API key needed) |
| Storage | localStorage for checks, sort prefs, Steam ID |
| Animations | View Transitions API, CSS `grid-template-rows`, GPU-accelerated transforms |

## Getting Started

```bash
npm install
npm run dev
```

No API key or `.env` file required. Set your Steam ID directly in the app via the account button (top-right navbar).

## Project Structure

```
src/
├── app.css                          # Tailwind config + animations
├── app.html                         # HTML shell (dark mode)
├── lib/
│   ├── components/
│   │   ├── achievement_row.svelte   # Expandable achievement with toggle
│   │   └── game_card.svelte         # Game card with progress bar
│   ├── data/games/
│   │   ├── schema.json              # JSON Schema for game data
│   │   ├── _example.json            # Template for new games
│   │   └── {appId}.json             # Per-game achievement data
│   ├── server/
│   │   ├── games.ts                 # Game data loader (import.meta.glob)
│   │   └── steam/api.ts             # Steam Web API calls
│   └── types/
│       ├── game.ts                  # GameData, Achievement, AchievementGuide
│       └── steam.ts                 # SteamGameDetails, SteamAchievementStatus
├── routes/
│   ├── +layout.svelte               # Global navbar + View Transitions
│   ├── +page.svelte                 # Game library with completion progress
│   ├── +page.server.ts              # Server-side game list loader
│   ├── api/steam/sync/[appId]/
│   │   └── +server.ts              # Steam achievement sync endpoint
│   └── game/[appId]/
│       ├── +page.server.ts          # Game detail data loader
│       └── +page.svelte             # Achievement list + filters + bottom bar
└── .github/
    ├── agents/platworks-dev.agent.md  # Copilot custom agent
    └── prompts/generate-game-data.prompt.md  # AI game data generator
```

## Adding a Game

Use the Copilot prompt to generate achievement data:

```
/generate-game-data "Game Name"
```

This scrapes Steam, TrueAchievements, and Reddit for the full achievement list with guides, then outputs a JSON file at `src/lib/data/games/{appId}.json`.

To add one manually, copy `_example.json` and follow the schema.

## Available Games

| Game | App ID | Achievements |
|------|--------|-------------|
| No Man's Sky | 275850 | 27 |
| Monster Hunter Wilds | 2246340 | 50 |
| Monster Hunter: World | 582010 | 100 |
| Palworld | 1623730 | 75 |
| Remnant II | 1282100 | 65 |
| Elden Ring | 1245620 | 42 |
| Battlefield 6 | 2807960 | 53 |
| Crimson Desert | 3321460 | 34 |
| Clair Obscur: Expedition 33 | 1903340 | 55 |
| Aniimo | 4126040 | 64 |
| Active Matter | 2887580 | 38 |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run check` | TypeScript + Svelte type checking |
