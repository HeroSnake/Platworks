---
description: "Use when adding or editing a game's achievement data in PlatWorks: src/lib/data/games/*.json, schema.json, guides, warnings, mapUrl, difficulty/type fields, or the icon fetch/verify scripts."
tools: [read, edit, search, execute, web]
---

# PlatWorks — game data layer

**You own:** `src/lib/data/games/*.json`, `schema.json`, `_example.json`, `#lib/types/game.ts`, `#lib/server/games.ts`, and `scripts/`.

**Always paired with:** [platworks-dev.agent.md](./platworks-dev.agent.md). The `/generate-game-data` prompt in `.github/prompts/generate-game-data.prompt.md` is the AI path to this work and already carries the mandatory research rules.

---

## 1. Shape

`schema.json` is the contract; `game.ts` is the TypeScript mirror. Both must change together when a field is added.

```
src/lib/data/games/
├── schema.json      # JSON Schema — the source of truth for shape
├── _example.json    # template to copy for a new game
└── {appId}.json     # one file per game
```

`#lib/server/games.ts` loads them with `import.meta.glob('#lib/data/games/[0-9]*.json')` — **the numeric prefix in the glob is what keeps `_example.json` and `schema.json` out of the library**. Renaming or adding a non-numeric file there will surface it as a broken game.

Per game: `appId`, `name`, `totalAchievements`, optional `mapUrl`, and `achievements[]`.
Per achievement: `id`, `name`, `description`, optional `iconUrl`, `type` (`standard | missable | multiplayer | cumulative | secret`), `difficulty` (`easy | medium | hard | very-hard`), and a `guide`.

## 2. Guide depth is a quality bar, not a suggestion

**Never invent a URL.** Only write one that was actually opened. A plausible-but-
unverified TrueAchievements or wiki link is worse than no link, because it looks
correct and fails silently for the user.

The same rule drives three fields:

- `guide.sourceUrl` — deep link to *this* achievement's page, not a game index. Most games should end up with one on the large majority of entries; `0%` coverage means the research was not done.
- `guide.videoUrl` — a video walkthrough, when one genuinely exists.
- `guide.communityNotes` / `guide.warnings` — **optional ≠ skip**. `warnings` is load-bearing: anything permanently missable, one-time-only, or commonly failed belongs there.

## 3. Interactive maps

`GameData.mapUrl` is the game's map (shown in the header and as the fallback "Game Map" link in every trophy). `guide.mapUrl` is a per-trophy deep link; only set it when the trophy is tied to a specific spot worth jumping straight to.

Verification rule: **only save a `mapUrl` that returned HTTP 200.** `wiki.gg` and `fandom` return 403 to scripted requests (Cloudflare bot protection) even though they work in a browser; that is not the same as a dead link, but it is also not verified. Those were deliberately left out — do not add them without checking in a real browser first. Prefer MapGenie → official map → wiki map page.

Omit `mapUrl` entirely for linear or competitive games. That is a correct answer, not an omission.

## 4. Icon scripts

| Script                                 | Job                                         |
| -------------------------------------- | ------------------------------------------- |
| `scripts/fetch-achievement-icons.mjs`  | scrape `iconUrl` into the game JSON         |
| `scripts/verify-achievement-icons.mjs` | audit that every stored icon still resolves |

Run them with `node`, **not** an npm script:

```bash
node scripts/fetch-achievement-icons.mjs              # every game missing an icon
node scripts/fetch-achievement-icons.mjs 1245620      # just one
node scripts/fetch-achievement-icons.mjs --force      # re-scrape everything
```

The scraping target and all of its traps (one URL per trophy, 64×64 native, display-name-only join, reused art, silent no-op) are documented in [platworks-steam.agent.md](./platworks-steam.agent.md) §3. The short version: **a duplicated `iconUrl` is not a bug, and an unmatched name must be reported — never fuzzily assigned.**

`iconUrl` is optional in the schema, so a hand-added game still validates.

## 5. Adding a game, end to end

1. `/generate-game-data "Game Name"` in Copilot, or hand-copy `_example.json`.
2. Write `src/lib/data/games/{appId}.json` — verify `totalAchievements` matches the array length.
3. `node scripts/fetch-achievement-icons.mjs {appId}`.
4. `node scripts/verify-achievement-icons.mjs`.
5. `npm run check` — the loader glob and the type mirror are validated by the build.
6. README § Features only if the game changes what the app *does*; the structure tree needs no edit for a data file.

Adding a *type* or *difficulty* value means updating `schema.json`, `game.ts`, and the filter UI in `game/[appId]/+page.svelte` together.