# PlatWorks

A completionist companion for Steam gamers: every achievement unpacked into step-by-step guides, missable warnings, and progress tracking.

<img width="1523" height="932" alt="image" src="https://github.com/user-attachments/assets/075cad15-d102-4c35-81ee-6fcc98c07211" />

[![PlatWorks](https://img.shields.io/badge/GitHub-HeroSnack%2FPlatworks-66c0f4?style=flat-square&logo=github)](https://github.com/HeroSnake/Platworks)

## What it does

PlatWorks turns a game's trophy list into something you can actually act on. Instead of a grid of greyed-out names, you get the official Steam artwork, the steps to unlock each trophy, a warning when it's missable, and a link to a full walkthrough.

- **Guides for every trophy** — step-by-step instructions, video walkthroughs, community tips from Reddit, and clear warnings on missable or one-time-only achievements
- **Real trophy artwork** — the official Steam icon for all 1647 achievements, not placeholders. The trophy *is* the checkbox: tap it to mark it done
- **Your library, your numbers** — pick the games you actually own and every total, percentage and sync is measured against that list, not the whole catalogue
- **Progress that sticks** — check off trophies by hand, or connect a public Steam profile and sync them in bulk. Your completion percentage follows you from game to game
- **Search and filter** — find games by name, trophies by name or description, then sort by completion, recently played, or difficulty and filter by locked state and trophy type
- **Interactive maps** — open-world games link straight to a community map, both from the game header and from individual trophy locations
- **No API key, no accounts** — PlatWorks reads Steam's public endpoints only. There is nothing to sign up for and no key to configure

<img width="864" height="369" alt="image" src="https://github.com/user-attachments/assets/a79284c2-5db6-4cde-a402-8f845d9c51a9" />

## Games

29 games, 1647 achievements, all with official artwork:

| Game | Achievements | Map |
|------|-------------:|:---:|
| Active Matter | 38 | |
| Aniimo | 64 | |
| Apex Legends | 12 | |
| Battlefield 6 | 53 | |
| Clair Obscur: Expedition 33 | 55 | ✓ |
| Counter-Strike 2 | 1 | |
| Crimson Desert | 34 | ✓ |
| Cyberpunk 2077 | 57 | ✓ |
| Deep Rock Galactic | 69 | |
| Dyson Sphere Program | 128 | |
| Elden Ring | 42 | ✓ |
| Grand Theft Auto V Enhanced | 77 | ✓ |
| Hades | 49 | |
| Marathon | 14 | |
| Monster Hunter Wilds | 50 | ✓ |
| Monster Hunter: World | 100 | |
| No Man's Sky | 27 | |
| Palworld | 75 | ✓ |
| Red Dead Redemption 2 | 51 | ✓ |
| Remnant II | 65 | |
| Rust | 116 | |
| Starfield | 82 | ✓ |
| Steep | 41 | |
| Terraria | 137 | ✓ |
| The Witcher 3: Wild Hunt | 78 | ✓ |
| Tom Clancy's Rainbow Six Siege | 48 | |
| Tower Factory | 21 | |
| Valheim | 53 | |
| WARDOGS | 10 | |

Want a game that's missing? [Open an issue](https://github.com/HeroSnake/Platworks/issues) and say which one.

## Running it

```bash
npm install
npm run dev
```

Then open the printed URL. Connect your Steam account from the button in the top-right corner — it accepts an ID, a vanity name, or a profile URL.

To check your work before pushing:

```bash
npm run check    # types and templates
npm run build    # production build
```

## Built with

SvelteKit 3 and Svelte 5 runes, Tailwind CSS 4, TypeScript, and Steam's public community endpoints. No backend of its own — game data lives in the repo, and Steam is queried from the server at request time.

## Contributing

Project rules, architecture, and the traps that have already been fixed live in [`.github/agents/`](.github/agents/). Start with [`platworks-dev.agent.md`](.github/agents/platworks-dev.agent.md) — it routes you to the file that owns whatever you're changing, whether that's UI, Steam integration, persisted state, or game data.

Game data can also be generated for you:

```
/generate-game-data "Game Name"
```
