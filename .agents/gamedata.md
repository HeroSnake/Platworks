---
description: "Use when adding or editing a game's achievement data in PlatWorks: src/lib/data/games/*.json, schema.json, guides, warnings, mapUrl, difficulty/types tag fields, or the icon fetch/verify scripts."
tools: [read, edit, search, execute, web]
---

# PlatWorks — game data layer

**You own:** `src/lib/data/games/*.json`, `schema.json`, `_example.json`, `#lib/types/game.ts`, `#lib/server/games.ts`, `scripts/`, and the README catalogue table.

**This file is the single source of truth for adding a game.** The README's contributing section points here.

**Always paired with:** [AGENTS.md](../AGENTS.md). The `/generate-game-data` prompt in `.github/prompts/generate-game-data.prompt.md` is the AI path to this work and already carries the mandatory research rules.

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
Per achievement: `id`, `name`, `description`, optional `iconUrl`, `types` (a **list**), `difficulty` (`easy | medium | hard | very-hard`), and a `guide`.

### `types` is a tag list, not an enum

`types` is `AchievementType[]` and the tags are **non-exclusive** — a trophy can be
`["missable","secret"]` or `["cumulative","multiplayer"]`. A single-value model would force a choice between
two true facts: Remnant II's `Succession` is *both* missable (the one true ending can be locked out) and
secret (Steam hides its description).

**There is deliberately no `standard` tag.** An empty array *is* the plain trophy.
Adding `standard` back would permit contradictions like `["standard","secret"]`.
The type filter in `game/[appId]/+page.svelte` offers a synthetic `standard` entry,
and it is a selection, not a tag — it matches `types.length === 0`.

Tag order in the JSON is canonical (`missable, multiplayer, cumulative, secret`) so a
hand-edited file and a generated one sort identically; the validator enforces it.

## 2. Guide depth is a quality bar, not a suggestion

**Never invent a URL.** Only write one that was actually opened. A plausible-but-
unverified TrueAchievements or wiki link is worse than no link, because it looks
correct and fails silently for the user. This also rules out reconstructed slugs
(`trueachievements.com/a<id>/<guessed-name>`): if you did not read it on a page,
you did not open it.

The same rule drives three fields:

- `guide.sourceUrl` — deep link to *this* achievement's page, not a game index. Required for **complex** achievements (score ≥ 4 on the prompt's traits table); pointless on trivial ones. Coverage of *complex* trophies is the bar — a raw percentage is not, and a game whose list is entirely self-explanatory legitimately ends at `0%` (three shipped files do).
- `guide.videoUrl` — a video walkthrough, when one genuinely exists.
- `guide.communityNotes` / `guide.warnings` — **optional ≠ skip**. `warnings` is load-bearing: anything permanently missable, one-time-only, or commonly failed belongs there.

`guide.steps` has a schema minimum of **one** (`minItems: 1`), not two. A trivial trophy gets exactly the steps its own text implies; padding it to five is noise, and noise in one entry makes the whole file harder to trust.

## 2b. Research is triage-gated, not per-achievement

`/generate-game-data` scores every achievement **offline** from its name and
description before it makes a single request, then works down: achievement text →
one index page → per-achievement pages → one Reddit sweep per game. The scrape
target, the traits table, and the per-game request budget all live in
[`generate-game-data.prompt.md`](../.github/prompts/generate-game-data.prompt.md).

### The todo list is the progress bar

The run is split into **eight phases per game** (Locate · Fetch achievement list ·
Triage achievements · Research complex achievements · Interactive map · Write game
JSON · Fetch trophy icons · Delete scratch dir) plus **two run-level tasks**
(`npm run check`, `Update README games table`). The prompt owns the exact phase
names; the bar is the `todo` list, and one todo exists per phase per game from
before the first fetch.

The rules that make it readable rather than decorative:

- Created **up front and complete**, so it can be read as progress at all — three games is 26 todos, not 3.
- `in_progress` on entry, `done` on exit. **Never batch-complete**; a bar that jumps 40% → 90% in one step reports nothing.
- **Exactly one `in_progress`** — work is sequential by design.
- Research may be **split per archetype after triage, never before** — splitting on a guess just adds noise.
- **`blocked` with a reason**, never a quiet `done`: no achievement page, all sources 403, not on Steam.
- An **already-generated game is asked about, never silently skipped or overwritten** — one batched question covering every collision, offering **replace** / **merge** / **keep**. A kept game collapses to one `Skip` todo instead of eight phantom phases; a replaced game runs all eight with phase 6 retitled. The hardcoded "Current library" list in the prompt is a convenience, never the check — glob the directory.
- `todo_deps` chain phase N → N−1, and each game → the previous game's cleanup, so the ready-task query yields exactly the one task that should be running.

The trap: a progress bar that is created as the work happens, or completed in
one sweep at the end, is worse than no bar — it looks like progress while telling
the user nothing.

Two traps behind it:

- **Re-fetching a page you already read** is the main cost sink. The agent logs
  every URL to `.tmp/game-data/{appId}/ledger.json` *before* fetching, and checks
  it before every request. Without the ledger the same wiki index gets re-opened
  four times in one run.
- **Writing a URL from memory.** Some shipped games have `0%` `sourceUrl` coverage and that is the
  intended outcome, not a to-do. Do not "fix" them by inventing links.

### Scratch workspace: `.tmp/game-data/{appId}/`

The agent may create and delete anything under `.tmp/` (gitignored): the fetch
`ledger.json`, a `findings.jsonl` of per-achievement results, and the parsed
`achievements.json`. It is repo-local **on purpose** — this repo is
edited from Windows and built from WSL, so a system temp dir is two different
paths and the agent loses its own work mid-run. Scratch files never go in
`src/`, the repo root, or `scripts/`. The directory is deleted once `npm run check`
passes.

**A scraper that will be needed again belongs in `scripts/agent/`, not here.**
The Steam achievement list fetch is exactly that case and is already written —
`node scripts/agent/steam-achievements.mjs <appId>` does phase 2 in one command
and refuses to write a partial list. The same applies to the ledger
(`scripts/agent/ledger.mjs`) and to link verification (`scripts/agent/check-links.mjs`).
Writing a fourth copy of the same parser into `.tmp/` is how a scraper silently
starts disagreeing with the committed one.

**Verified:** `tsconfig.json` has `include: ["src", "*"]`, but TypeScript skips
dot-directories in wildcard patterns, so `.tmp/**` is never type-checked even with
`allowJs`/`checkJs` on. A junk `.mjs` under `.tmp/` leaves `npm run check` at 0
errors. `scripts/**` is *also* outside the program — `.mjs` is not matched by the
default extension list — so `scripts/agent/` is not type-checked either. Do not add
a speculative `exclude` entry for either.

## 3. Interactive maps

`GameData.mapUrl` is the game's map (shown in the header and as the fallback "Game Map" link in every trophy). `guide.mapUrl` is a per-trophy deep link; only set it when the trophy is tied to a specific spot worth jumping straight to.

Verification rule: **only save a `mapUrl` that returned HTTP 200.** `wiki.gg` and `fandom` return 403 to
scripted requests (Cloudflare bot protection) even though they work in a browser; that is not the same as
a dead link, but it is also not verified. Omit those rather than saving them unverified — do not add them
without checking in a real browser first. Prefer MapGenie → official map → wiki map page.
`node scripts/agent/check-links.mjs --game <appId>` checks every stored link and reports a Cloudflare 403
as *unverifiable* rather than dead, so the distinction is never lost to a raw status code.

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

The scraping target and all of its traps (one URL per trophy, 64×64 native, display-name-only join, reused art, silent no-op) are documented in [steam.md](./steam.md) §3. The short version: **a duplicated `iconUrl` is not a bug, and an unmatched name must be reported — never fuzzily assigned.**

`iconUrl` is optional in the schema, so a hand-added game still validates.

## 5. Adding a game, end to end

1. `/generate-game-data "Game Name"` in Copilot, or hand-copy `_example.json`.
   If the game is already in `src/lib/data/games/`, the prompt **asks** whether to
   replace, merge or keep it — answer that question before the run continues.
2. Write `src/lib/data/games/{appId}.json` — verify `totalAchievements` matches the array length.
3. `node scripts/agent/steam-achievements.mjs {appId}` — the authoritative name / description / unlock-rate list.
4. `node scripts/fetch-achievement-icons.mjs {appId}`.
5. `node scripts/verify-achievement-icons.mjs`.
6. `node scripts/agent/check-links.mjs --game {appId}` — every stored link still resolves.
7. `npm run check` — the loader glob and the type mirror are validated by the build.
8. Delete `.tmp/game-data/` once the run is verified.
9. Add a row to the **README catalogue** table — the game name and achievement count. That is the only
   README edit a data file needs.

Adding a *tag* value means updating `schema.json`, `game.ts` (`AchievementType`), and the badge/icon maps in `achievement_row.svelte` together. Adding a *difficulty* value means `schema.json`, `game.ts`, and the filter/sort UI in `game/[appId]/+page.svelte`.