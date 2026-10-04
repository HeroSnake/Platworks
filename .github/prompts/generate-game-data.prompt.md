---
description: "Generate PlatWorks game data JSON files for one or more Steam games. Scrapes achievement lists, guides, video links, and Reddit community tips."
agent: "agent"
tools: [web, edit, read, search, execute, todo]
---
# Generate Game Data Files

You are a research agent that generates achievement guide data for Steam games.

## Input

The user will provide **one or more game names or Steam App IDs**, separated by commas, newlines, or as a list.

Examples:
- `/generate-game-data "Hollow Knight"`
- `/generate-game-data "Hollow Knight", "Celeste", "Hades"`
- `/generate-game-data 367520, 504230`

Some of these may already be in `src/lib/data/games/`. **If any requested game
already has a JSON file, ask the user whether to replace it before starting** —
see [Existing games](#existing-games). Do not overwrite or skip unasked.

### The mandatory rules

1. **Never invent an achievement or invent a URL.** Every `name` must match
   Steam's `<h3>` exactly. Every URL must be one you actually opened. A plausible
   but unverified URL is worse than no URL, because it looks correct. A URL you
   reconstructed from a pattern, guessed from a slug, or copied from a sibling
   achievement counts as invented.

2. **Research the complex achievements only.** Score every achievement with the
   complexity triage below *before* opening a single URL. A self-evident trophy
   gets its guide written from the achievement text alone, and that is the
   correct answer — not a gap to be filled with invented steps. Every genuinely
   complex achievement needs a deep-link `sourceUrl` (TrueAchievements gives each
   achievement its own page, `https://www.trueachievements.com/a123456/some-achievement`;
   link to that page, never to a generic game index). Low `sourceUrl` coverage is
   only a failure signal if the game's trophies *are* complex.

3. **One fetch per URL, ever.** Before any request, check the ledger in the
   scratch directory. Every URL is logged with what it answered and which
   achievements it covered, so a page is never re-read, and a page that already
   answered the question is never opened again under a different spelling.

4. **Fetch fewer pages, not more.** A game's whole achievement list, most
   collectible tables, and all missable warnings usually live on *one* wiki or
   guide index page. Read that page once and serve every achievement from it.
   Per-achievement pages are for trophies the index did not answer.

5. **`communityNotes` are for what a guide will not tell you.** Gotchas, meta
   builds, "this is bugged as of patch X", ordering tricks. Prefix with
   `Reddit tip: ` and only write them if you actually found them. One search
   per *game* ("{game} missable achievements reddit") beats one search per
   trophy; never search Reddit for a self-evident achievement.

6. **`warnings` are load-bearing.** Anything permanently missable, one-time-only,
   or commonly failed belongs here. Empty is fine only for genuinely trivial
   trophies.

7. **Optional ≠ skip.** `videoUrl`, `communityNotes`, `warnings`, and `mapUrl` are
   optional in the schema so a hand-added game still validates.

### Complexity triage — do this offline, before any search

An achievement only earns research if it is not self-evident. Judge every trophy
from its **name and Steam description alone** — both are already in front of you,
so this costs no tokens and no requests. Score it, then act on the tier.

| Trait | Signal in the achievement text | Adds |
|---|---|---|
| **Self-evident** | The description states the action and nothing else: "Defeat the first boss", "Reach level 10", "Win a match" | −2 |
| **Hidden trigger** | The real condition is not stated — "Remember Me", "A Named Weapon" | +3 |
| **Specific target** | Requires finding or naming one item, NPC, area, quest or boss not in the text | +2 |
| **Condition** | "without…", "before…", "in under…", "only after…", a difficulty or NG+ qualifier | +3 |
| **Threshold** | A number implying a grind: "kill 1000", "complete all 30" | +2 |
| **Missable / one-time** | A choice, an event window, a one-shot opportunity | +3 |
| **Chain / order** | "All chapters", "each class", "both endings", a numbered sequence | +2 |
| **RNG / skill ceiling** | Speedruns, no-damage, solo-only, frame-perfect, <5% unlock rate | +2 |

| Score | Tier | What you do |
|---:|---|---|
| **≤ 0** | **Trivial** | Write the guide **from the achievement text**. One or two steps restating the condition in plain language. No request, no `sourceUrl`, no `videoUrl`, no `communityNotes`. `difficulty: easy`. This is a correct, complete answer. |
| **1–3** | **Ambiguous** | Write what you can, then look for **one** page covering this achievement or its category. Fill in only what the page adds. |
| **≥ 4** | **Complex** | Research it properly: per-achievement `sourceUrl`, a real walkthrough, warnings if missable. |

Two overrides, both upward:

- **Secret achievements** (Steam hides the description) are always Complex — the
  text cannot be read, so nothing can be inferred from it.
- **Anything scored on missable/one-time is at least Ambiguous** — a warning is
  load-bearing and must not be guessed at.

Two overrides, both downward:

- **A cumulative counter** ("kill 1000 enemies") is Ambiguous at most. The
  condition *is* the description; `type: "cumulative"` already conveys the grind.
- **A repeated archetype** — if 30 trophies are "defeat boss X", they need no
  30 separate pages. One page or the achievement text answers the archetype for
  all of them.

Record the triage in the scratch file, not in your head. Without it you re-derive
the same decision later and start opening pages you already opened.

### Interactive maps

If the game has a real open world or explorable map, set `mapUrl` on the
**`GameData`** object once:

```json
"mapUrl": "https://mapgenie.io/elden-ring"
```

Prefer, in order: MapGenie → the official map → the game's wiki map page →
a well-known community map. **Verify the URL returns 200 before saving it.** Omit
the field entirely for linear or competitive games where a map would not help —
that is a correct answer, not an omission.

## Scratch directory

All intermediate work goes under **`.tmp/game-data/{appId}/`** at the repo root.

```
.tmp/game-data/{appId}/
├── achievements.json  # the Steam list, parsed once: id, name, description, hidden, unlock rate
├── ledger.json        # every URL fetched, what it answered, which achievements it covered
└── findings.jsonl     # one line per achievement: triage score + what research found
```

**Repo-local, not `/tmp`.** A system temp dir would be a different path on the
Windows side and the WSL side of this repo — a file written by one is invisible
to the other, and the agent loses its own work halfway through. `.tmp/` resolves
to the same folder from both, and it is already in `.gitignore`.

**You may create, modify and delete anything in `.tmp/`.** It is yours for the
duration of the task. Two constraints only:

- Never write scratch files anywhere else — not `src/`, not the repo root. `.tmp/` is for
  *data*. If a task needs a **script** that will be written again next run, it belongs in
  `scripts/agent/`, committed — which is where the Steam list parser and the ledger CLI
  already live, so this run does not re-derive them.
- Never reference a `.tmp/` path from the game JSON or from any source file.

Delete `.tmp/game-data/{appId}/` at the end of phase 8, once that game's JSON is
written and its icons fetched. Keep it while other games are still running — it
is what stops the next game from re-fetching the same pages.

### The fetch ledger

`ledger.json` is the answer to "have I already opened this page?". **It is a CLI, not
a format you hand-maintain** — `node scripts/agent/ledger.mjs <appId> …`:

| Command | When |
|---|---|
| `check <url>` | **Before every request.** Exit 0 means already read — read what it answered instead of fetching again. |
| `add <url>` | **Before the request.** Writes `status: "pending"` so a crashed run still shows the page was being opened. |
| `resolve <url> --status N --covers a,b --answered "…"` | **After.** Closes the entry out with what it served. |
| `list`, `stats`, `uncovered --all` | Reporting. `stats` names pending and blocked entries. |

One entry per URL, and the CLI enforces the three rules that make it work:

1. **Log before fetching, fill `covers` after.** A URL already present is never
   requested again — `check` exits non-zero on anything it does not already hold, and
   `add` refuses a duplicate outright, so the same wiki index cannot be opened four
   times in one run. URLs are normalised first, so a trailing slash or a
   `#fragment` does not create a second entry for a page you already read.
2. **One page, many achievements.** Put every achievement the page served in
   `covers`, even ones you have not written yet. A collectible table that lists
   30 items settles 30 trophies in one entry.
3. **A dead end is still an entry.** `resolve --status 403`, then move on — do not
   retry with a different spelling. `wiki.gg` and `fandom` return 403 to scripted
   requests because of Cloudflare; that is recorded once and the source is dropped.

`findings.jsonl` is one line per achievement, written during triage and extended
as research lands — the text you would otherwise re-derive from a page you have
already closed:

```json
{"id": "FIND_3_SHARDS", "score": 5, "tier": "complex", "sourceUrl": "https://…", "steps": ["…"], "warnings": ["…"], "videoUrl": null, "mapUrl": null}
```

The `score` is what stops you re-deriving the same triage decision later, and it
makes the run resumable: pick the game back up, read the three files, and you know
exactly what is left to do.

### Budget

A 50-achievement game should need **under 15 requests**: 1 for the Steam list, 2
or 3 for the wiki/guide index and one Reddit sweep, then one page each for the
trophies the index did not answer. If you are approaching one request per
achievement, the triage has failed — go back and re-score.

## Progress tracking

**The todo list is the progress bar.** Populate it before the first fetch, keep
it truthful as you work, and never leave it stale — a bar reading 60% while the
agent is three phases deep is worse than no bar at all.

**Up front, and complete.** Create one todo per phase per game, plus the two
run-level tasks, *before any research starts*. A bar that materialises as you go
cannot be read as progress. For three games that is 26 todos, not 3 — the
granularity is the point.

| # | Phase (`## Process` heading) | Todo title |
|---|---|---|
| 1 | Locate | `{Game} · Locate appId` |
| 2 | Fetch achievement list | `{Game} · Fetch achievement list` |
| 3 | Triage achievements | `{Game} · Triage achievements` |
| 4 | Research complex achievements | `{Game} · Research complex achievements` |
| 5 | Interactive map | `{Game} · Interactive map` |
| 6 | Write game JSON | `{Game} · Write game JSON` |
| 7 | Fetch trophy icons | `{Game} · Fetch trophy icons` |
| 8 | Delete scratch dir | `{Game} · Delete scratch dir` |
| R1 | — | `npm run check` |
| R2 | — | `Update README games table` |

Phase numbering and names match the `## Process` headings below exactly. If you
rename a phase there, rename it in this table too.

Rules that make the bar worth reading:

- **`in_progress` before starting, `done` the moment it finishes.** Never batch-complete phases at the end; a bar that jumps 40% → 90% in one step has told the user nothing.
- **Exactly one `in_progress` at a time.** Work is sequential by design. Two concurrent bars mean the phases are lying about the order.
- **Phase 4 may be split — after triage, never before.** If a game has many complex achievements, replace the single research todo with one per archetype (`Research · collectibles`, `Research · missables`, `Research · endings`). Splitting before triage means guessing at the work, and guessed todos are noise on the bar.
- **`blocked`, never a quiet `done`.** No achievement page, every source 403, the game is not on Steam — mark the phase `blocked` with the reason and move to the next game. A blocked bar is information; a completed one is a lie.
- **An existing file is a question, never a silent skip or a silent overwrite.** Resolve which games already exist first — it is a single glob over `src/lib/data/games/`. Batch every collision in the run into **one** question before any research starts (see [Existing games](#existing-games)), then let the answer shape the todo list: kept game → one `Skip {Game} — user chose to keep` todo, not eight phantom phases dragging the bar to 60%; replaced game → the full eight phases with phase 6 retitled `{Game} · Replace game JSON`.
- **Chain the dependencies** in `todo_deps`: each phase depends on the previous one within a game, and each game's first phase depends on the previous game's cleanup. The ready-task query then returns exactly one task — the one that should actually be running.

**R1 and R2 run once, after every game.** `npm run check` validates the whole batch, and the README games table is a single edit covering all the games that were added.

## Process

Eight phases per game, run **sequentially — complete one game fully before
starting the next**. Each phase is one todo; update its status as you enter and
leave it.

### 1 · Locate

Resolve the Steam App ID if it was not provided (one store-page search). Check
whether `src/lib/data/games/{appId}.json` already exists.

**If it does, stop and ask the user whether to replace it** — never overwrite on
your own initiative, and never silently skip a game the user asked for. The ask
is defined in [Existing games](#existing-games): report the existing file's appId,
name and achievement count, and offer **replace** / **merge** / **keep**. Asking
costs one message; guessing costs a reviewed file or a silently missing game.

On **replace**, delete the existing `src/lib/data/games/{appId}.json` first — the
run writes a whole new file, so a stale field can only survive if the old file
stays. On **merge**, keep the file and rewrite only what the user named; never
blank out achievements that were not in scope, and never overwrite an existing
`iconUrl` with a guess (phase 7 owns icons).

On **keep**, create a single `Skip {Game} — user chose to keep` todo, mark it
`done` with the reason, and move to the next game. Otherwise create the scratch
directory `.tmp/game-data/{appId}/` with `achievements.json`, `ledger.json`,
`findings.jsonl` and `scripts/`.

### 2 · Fetch achievement list

Fetch `https://steamcommunity.com/stats/{appId}/achievements` **once** — the
authoritative source for names and IDs. Parse it to
`.tmp/game-data/{appId}/achievements.json` (id, name, description, hidden,
unlock rate), then work from that file for the rest of the run. The unlock rate is
also how you spot the rare, grind-heavy trophies worth researching in phase 4.

```bash
node scripts/agent/steam-achievements.mjs 1245620 --name "ELDEN RING"
```

It fetches once, refuses to write a partial list when the page's own count
disagrees with the rows parsed, and prints the five rarest trophies to triage
against. It also prints the one thing it cannot do: **the public page carries no
API name, so every `id` comes back `null`.** Take those from the Steamworks partner
site or `GetSchemaForGame`. `name` is the join key for the icon scraper in phase 7,
so it must stay exactly as Steam spells it.

### 3 · Triage achievements

Score every achievement against the traits table above and write the scores to
`findings.jsonl`. **No web requests happen before this phase is done for the
whole list.** Deciding what to skip while you are already browsing is how a
one-page job turns into fifty.

### 4 · Research complex achievements

Work by archetype, cheapest source first. Stop as soon as an achievement is
answered:

1. **The achievement text itself** — trivial and archetype trophies are done here.
2. **One index page** — the game's wiki achievements page or the TrueAchievements
   game index usually carries names, descriptions, missable tables and locations
   for the entire list in a single fetch. Log it once with every achievement it
   covers.
3. **Per-achievement pages** — only for complex trophies the index did not
   answer. Take each URL from a link you actually saw on the index, never from a
   constructed slug.
4. **Reddit** — one search per *game* (`site:reddit.com {game} missable
   achievements`), not per trophy. Only for trophies scored ambiguous or complex.
   Split notes out with `Reddit tip: `.
5. **Video** — a genuine walkthrough only, for boss fights and the hardest
   routes. Never hunt for one per trophy.

Log every request in the ledger as you make it, with the achievements it covered.
Check the ledger first: a URL already in it is not fetched again.

### 5 · Interactive map

At most two candidate URLs, and only if one actually returns 200 (see above).
Linear or competitive game: omit it — that is a correct answer, not a failure.

Verify a candidate before saving it:

```bash
node scripts/agent/check-links.mjs --url https://mapgenie.io/elden-ring
```

A 403 from wiki.gg or fandom is **unverifiable, not dead** — Cloudflare blocks every
scripted request while the page works fine in a browser. The script reports those
separately for exactly that reason. Do not drop a link because a script could not open it.

### 6 · Write game JSON

Write `src/lib/data/games/{appId}.json` following the schema in
`src/lib/data/games/schema.json`.

On a **replace**, the previous file has already been deleted in phase 1 — this
writes a new one from nothing. On a **merge**, edit the existing file in place and
change only what the user named.

### 7 · Fetch trophy icons

```bash
node scripts/fetch-achievement-icons.mjs {appId}
node scripts/verify-achievement-icons.mjs
```

The scraper pulls the official artwork from the same global list and matches rows
by display name. Do not hand-write `iconUrl` values. If it reports achievements it
could not match, fix the `name` to match Steam's `<h3>` exactly — do not paste a
nearby row's URL.

### 8 · Delete scratch dir

Remove `.tmp/game-data/{appId}/` now that the JSON is written and the icons are
fetched. Keep it for the rest of the batch only if you still have games to do;
it is the reason the next game does not re-fetch the same pages.

### Then, once for the whole batch

**R1 · `npm run check`** — verify no type errors.
**R2 · README games table** — one row per game added, with appId and achievement count.

Then delete `.tmp/game-data/` if any of it remains, and summarize: per game, the
achievements written, the trivial / ambiguous / complex split, how many
`sourceUrl`s were attached, and how many requests the ledger recorded.

For a **replaced** game also report the delta against what was overwritten —
achievements added, removed, or changed — and flag anything the old file had that
the new one does not (a verified `sourceUrl`, a `mapUrl`, a `communityNote`). A
replacement that silently drops reviewed research is a regression, and the user
cannot see it unless you say so.

## Schema Reference

Use the types from `src/lib/types/game.ts`:

```typescript
type AchievementType = 'missable' | 'multiplayer' | 'cumulative' | 'secret';

interface GameData {
  appId: number;
  name: string;
  totalAchievements: number;
  mapUrl?: string;       // interactive map for the whole game, if one exists
  achievements: Achievement[];
}

interface Achievement {
  id: string;           // Steam internal achievement ID
  name: string;         // Steam display name, EXACTLY as listed
  description: string;
  iconUrl?: string;     // filled in by scripts/fetch-achievement-icons.mjs — do not hand-write
  types: AchievementType[];  // non-exclusive tags; [] = an ordinary trophy
  difficulty: 'easy' | 'medium' | 'hard' | 'very-hard';
  guide: {
    steps: string[];           // 1-5 specific, non-interchangeable steps
        sourceUrl?: string;        // deep link to THIS achievement's guide — required for complex ones, omit on trivial ones
    videoUrl?: string;         // YouTube or similar
    mapUrl?: string;           // deep link to a specific location, if worth it
    communityNotes?: string[]; // Reddit tips, prefix with "Reddit tip: "
    warnings?: string[];       // Missable alerts, gotchas
  };
}
```

### `types` is a tag list — apply every tag that is true

`types` is an **array of non-exclusive tags**. A trophy frequently satisfies more than
one, and recording only the most obvious one loses real information:

| Trophy | Correct `types` |
|---|---|
| Secret one-true-ending you can lock out | `["missable","secret"]` |
| Hidden grind counter | `["cumulative","secret"]` |
| Online-only co-op trophy | `["multiplayer","cumulative"]` |
| Plain trophy with nothing notable | `[]` |

Rules:

- **There is no `standard` tag.** An ordinary trophy is `"types": []`. Never write
  `["standard"]` — it is not in the enum and would fail validation.
- **Never drop a true tag to keep the list short.** `Succession` in Remnant II is both
  `missable` and `secret`; picking one of them tells the player something false.
- **Write tags in canonical order** — `missable, multiplayer, cumulative, secret` —
  so a hand-edited file sorts identically to a generated one.
- Steam hides the description of `secret` trophies, so read the hidden flag from the
  achievement list in phase 2 rather than guessing it from the name.

## Rules

- Include `"$schema": "./schema.json"` at the top of the JSON file.
- `totalAchievements` MUST match the length of the `achievements` array.
- Every achievement MUST have at least one step in the guide (the schema minimum).
  **A trivial achievement gets exactly the steps its own text implies** — one or
  two, no filler. Padding a "Defeat the first boss" trophy to five steps to look
  thorough makes the whole file less trustworthy. Steps must be specific enough
  to act on and **not interchangeable with another trophy's steps**.
- **`name` MUST be the display name exactly as it appears on the Steam global achievement list.** This is the join key that `scripts/fetch-achievement-icons.mjs` uses to attach icons, and it is what sync matches against. Never invent an achievement that Steam does not list, and never rename one — an invented entry leaves the file permanently one achievement short with no icon. Watch the apostrophes: Steam uses curly quotes (`Dead Man’s Chest`).
- **`sourceUrl` is required for complex achievements, and pointless on trivial ones.** Link the achievement's own page (e.g. `https://www.trueachievements.com/a398513/the-killing-jar-achievement`), not a generic game index, and only a URL you actually opened. A `sourceUrl` on a self-evident trophy is decoration; a missing one on a quest chain is a defect.
- **`mapUrl` must be verified** to return HTTP 200 before saving. No map = omit the field; that is a valid answer for linear or competitive games.
- Add `missable` if the trophy can be permanently missed in a single playthrough.
- Add `secret` if the Steam store hides its description — and keep any other true tag alongside it.
- Prefix Reddit-sourced notes with `"Reddit tip: "` — and only write notes you actually found.
- See `src/lib/data/games/_example.json` for reference.

## Achievement Tag Guide

`types` is a list. Apply **every** tag below that is true — they do not exclude each other.

| Tag | When to use |
|------|-------------|
| `missable` | Can be permanently missed in a single playthrough (e.g. choices, one-time events) |
| `multiplayer` | Requires online co-op or PvP to earn |
| `cumulative` | Earned over time across multiple sessions (e.g. "kill 1000 enemies") |
| `secret` | Description is hidden on the Steam store page |
| *(no tag)* | An ordinary trophy — write `"types": []`. **Never write `standard`.** |

## Difficulty Rating Guide

Rate the **effort**, not the length of the guide. A trivial trophy that needed no
research is `easy` by definition — difficulty is never a proxy for how hard the
trophy was to research.

| Rating | Criteria |
|--------|----------|
| `easy` | Earned naturally through normal gameplay, no special effort |
| `medium` | Requires some exploration, grinding, or specific knowledge |
| `hard` | Requires significant effort, skill, or multiple playthroughs |
| `very-hard` | Extreme grind, high skill ceiling, or rare RNG — often < 5% unlock rate |

## Sourcing Priority

Ordered by **answers per request**, not by authority. Work down the list and stop
as soon as the achievement is covered.

1. **The achievement text itself** — free, and correct for trivial trophies
2. **One index page** — the wiki achievements page or the TrueAchievements game
   index; usually the whole list in a single fetch
3. **Steam Community** — official names, descriptions, unlock rates, hidden flags
4. **Per-achievement pages** — only for complex trophies the index did not answer
5. **Reddit** — one search per game, for bugged, RNG-heavy or missable trophies
6. **YouTube** — video walkthroughs for boss fights and tricky routes

Log each of these in `.tmp/game-data/{appId}/ledger.json`, and do not fetch a URL
that is already in it.

## Existing games

**Ask before you touch an existing file.** `src/lib/data/games/{appId}.json` may
already exist, and it holds reviewed, hand-corrected data. Treat a collision as a
question with three answers, never as a decision you make silently.

### The ask

Before any fetch, glob `src/lib/data/games/` and compare it against the requested
games. If **anything** collides, stop and ask — once, covering every collision in
the run, not one prompt per game:

> `1245620.json` already exists — **Elden Ring**, 42 achievements.
> How do you want to handle it?
> 1. **Replace** — regenerate from scratch and overwrite the file.
> 2. **Merge** — keep the file, update only what I name (name the achievements).
> 3. **Keep** — leave it exactly as it is.

Report only what reading the file actually showed — name, `totalAchievements`, and
the achievement count. Do not add coverage statistics you have not counted.

Say the same for each colliding game in one message, so a three-game run asks once
rather than three times. If nothing collides, do not ask — a missing file is not a
question.

Never overwrite unasked, and never skip without asking. Two failure modes, both
real: an unasked overwrite silently discards corrections someone made by hand, and
an unasked skip means a run the user started quietly produces nothing while the
progress bar reads `done`.

### What each answer means

| Answer | Do this | Todos |
|---|---|---|
| **Replace** | `rm src/lib/data/games/{appId}.json`, then run all eight phases | Full eight; phase 6 retitled `{Game} · Replace game JSON` |
| **Merge** | Keep the file; rewrite only the named achievements; preserve everything else, including `iconUrl` | Full eight, but phase 4 scoped to the named achievements |
| **Keep** | Touch nothing | One `Skip {Game} — user chose to keep`, marked `done` with the reason |

On **merge**, the existing file is the baseline: read it before phase 3 so triage
scores the real guides, and diff against it at the end so the run reports exactly
what changed. Anything you did not verify stays as it was.

On **replace**, the old file goes first — the run writes a whole new one, so any
field it no longer produces would otherwise survive as stale data. A replacement
that drops a `sourceUrl` the reviewer had verified should be called out in the
summary, not shipped quietly.

If the user pre-authorises it in the request ("regenerate Elden Ring", "overwrite
existing"), that counts as the answer: say which games you are replacing, then
proceed without asking again.
