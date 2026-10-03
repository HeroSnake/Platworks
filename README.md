# PlatWorks

The ultimate completionist companion for Steam gamers. Break down Steam achievements into step-by-step guides, missable alerts, and progress tracking — all in a mobile-first, 60fps interface.

[![PlatWorks](https://img.shields.io/badge/GitHub-HeroSnack%2FPlatworks-66c0f4?style=flat-square&logo=github)](https://github.com/HeroSnake/Platworks)

## Features

- **Achievement guides** — step-by-step instructions, video links, Reddit community tips, and missable warnings for every trophy. Every non-trivial and complex trophy links to a full walkthrough, and most games also carry an interactive map for the location
- **Official trophy artwork** — every achievement shows its real Steam icon, scraped from the same official list the IDs and names came from. The trophy doubles as the check button, so the art is full-size (64px, the native resolution) *and* the tap target is a comfortable 64×64 on a phone. Unlocked trophies render in full colour with a green ring; locked ones are greyed out
- **Progress tracking** — manually check off achievements or sync with any public Steam profile
- **No API key required** — syncs via public Steam community XML endpoints (profile must be public)
- **Steam account in navbar** — set your Steam ID/vanity/URL once; your avatar and persona name are cached in localStorage and refreshed after each sync, so browsing never re-queries Steam
- **Sync all games** — one button on the home page syncs every incomplete game at once
- **Search, sort, filter** — search games by name, search trophies by name *or* description, sort by A–Z / completion / recently played / difficulty, filter by locked state and type
- **Remembers your preferences** — sort order and achievement filters are persisted per game and restored when you return
- **Mobile-first UI** — one shared bottom bar (sync / search / filter / back-to-top) used by both pages, where search and filter share a single expanding row. The navbar is 64px tall on phones with 44px tap targets, then tightens back to a 56px bar on desktop
- **60fps animations** — View Transitions API for page slides, CSS grid-rows expand/collapse, GPU-only transforms
- **AI-powered data generation** — use `/generate-game-data` to scrape and build achievement guides for any Steam game (supports multiple games at once)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 3 + Svelte 5 (Runes: `$state`, `$derived`, `$props`, `$effect`) |
| Styling | Tailwind CSS v4 with custom Steam color theme |
| Icons | @lucide/svelte |
| Type Safety | TypeScript (strict) |
| API | Steam public XML endpoints (no API key needed) |
| Storage | localStorage for checks, sort/filter prefs, Steam ID, cached profile |
| Animations | View Transitions API, CSS `grid-template-rows`, GPU-accelerated transforms |

## Getting Started

```bash
npm install
npm run dev
```

No API key or `.env` file required. Set your Steam ID directly in the app via the account button (top-right navbar).

> **Note for contributors:** this project targets **SvelteKit 3**. Config lives in `vite.config.ts` — creating a `svelte.config.js` is a hard startup error — and shared code is imported with `#lib`, not `$lib`. Run `npm run check` before committing; it regenerates types first. `.github/agents/platworks-dev.agent.md` documents the framework gotchas and project rules.

## Project Structure

```
vite.config.ts                      # SvelteKit options live here (there is no svelte.config.js)
src/
├── app.css                          # Tailwind config + animations
├── app.html                         # HTML shell (dark mode)
├── lib/
│   ├── client/
│   │   └── profile.ts               # localStorage cache for the Steam profile card
│   ├── components/
│   │   ├── achievement_row.svelte   # Expandable trophy card with toggle + Steam icon
│   │   ├── game_card.svelte         # Game card with progress bar
│   │   ├── github_icon.svelte       # Inline GitHub mark (lucide ships no brand logos)
│   │   └── mobile_bar.svelte        # Shared mobile bottom bar (both pages)
│   ├── data/games/
│   │   ├── schema.json              # JSON Schema for game data
│   │   ├── _example.json            # Template for new games
│   │   └── {appId}.json             # Per-game achievement data
│   ├── server/
│   │   ├── games.ts                 # Game data loader (import.meta.glob)
│   │   └── steam/api.ts             # Steam XML calls (server-only)
│   └── types/
│       ├── game.ts                  # GameData, Achievement, AchievementGuide
│       └── steam.ts                 # SteamGameDetails, SteamAchievementStatus, SteamProfile
├── routes/
│   ├── +layout.svelte               # Global navbar, account popover, View Transitions
│   ├── +page.svelte                 # Game library with completion progress
│   ├── +page.server.ts              # Server-side game list loader
│   ├── api/steam/
│   │   ├── profile/+server.ts       # Profile name + avatar endpoint
│   │   └── sync/[appId]/+server.ts  # Steam achievement sync endpoint
│   └── game/[appId]/
│       ├── +page.server.ts          # Game detail data loader
│       └── +page.svelte             # Achievement list + search + filters + bottom bar
scripts/
├── fetch-achievement-icons.mjs      # Scrape official Steam icons into the game JSON
├── verify-achievement-icons.mjs     # Check every stored icon still resolves
.github/
├── agents/platworks-dev.agent.md  # Copilot custom agent — project rules & gotchas
└── prompts/generate-game-data.prompt.md  # AI game data generator
```

## Adding a Game

Use the Copilot prompt to generate achievement data:

```
/generate-game-data "Game Name"
```

This scrapes Steam, TrueAchievements, and Reddit for the full achievement list with guides, then outputs a JSON file at `src/lib/data/games/{appId}.json`.

To add one manually, copy `_example.json` and follow the schema.

### Adding the trophy icons

Icons are not written by hand. Once a game file exists, pull the official artwork in:

```bash
node scripts/fetch-achievement-icons.mjs              # every game missing an icon
node scripts/fetch-achievement-icons.mjs 1245620      # just one
node scripts/fetch-achievement-icons.mjs --force      # re-scrape everything
```

It reads the public global achievement list, matches each row to your entries by display name, and writes an `iconUrl` onto every achievement. Only the *unlocked* (coloured) image is published — the locked look is a CSS grayscale of the same file, so there is only ever one URL per trophy.

Entries that match nothing are listed at the end of the run. That usually means the display name drifted from Steam's, and needs a human decision — do not let the fuzzy fallback guess silently. Verify afterwards with:

```bash
node scripts/verify-achievement-icons.mjs
```

### Interactive maps

Open-world games set `mapUrl` once on the game object; the app shows a button in
the header and a "Game Map" link in every expanded trophy:

```json
"mapUrl": "https://mapgenie.io/elden-ring"
```

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
| Valheim | 892970 | 53 |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run check` | `svelte-kit sync` + svelte-check (types, templates, a11y) |
| `node scripts/fetch-achievement-icons.mjs` | Fill in `iconUrl` for every achievement that lacks one |
| `node scripts/verify-achievement-icons.mjs` | Confirm all stored icons resolve and data is consistent |
