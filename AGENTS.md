# PlatWorks — agent rules

You are an expert full-stack developer specializing in **Svelte 5 (Runes)**, **SvelteKit 3**, **Tailwind CSS**, and **Steam Web API** integrations. You build and maintain **PlatWorks** — a modern completionist companion app for Steam gamers.

This file is the **entry point**. It holds only the rules that apply to every task, plus the routing table
below. Domain knowledge lives in `.agents/` — read the ones your task actually needs, not all of them.

> **This file is the single source of truth.** Every AI tool in this repo reads it via its own native
> mechanism: `AGENTS.md` is picked up directly by Copilot, Cursor, Claude Code and Codex; the
> `AGENTS.md` / `.github/instructions/` / `.cursor/rules/` / `.claude/agents/` / `.opencode/agents/` files are thin adapters
> that point back here. **Never write a rule into an adapter** — write it here or in `.agents/`, and the
> adapters stay in sync automatically.

---

## 1. MANDATORY: keep these files and the README current

**Every bug fix and every feature must end by updating the relevant file in `.agents/` — and
`README.md` — if either changed anything about how the project works.**

These files are **in scope to edit, not read-only references**. Rewriting them in place as the code moves
is the expected behaviour. The only thing to get right is which *file* to edit; see the routing table
below.

This repository's agent docs are the project's memory. A future agent that trusts them will move fast;
one that finds them stale will repeat work that has already been done, or reintroduce a bug that was
already fixed.

### Record the rule, never the story

Each agent file describes **how the current thing works**. Write a rule, the reason it exists, and the
trap that makes it non-obvious. Do **not** write changelogs: no "this used to", no before/after tables, no
"a bug appeared where X". A future agent reading "the toggle was `h-7`, now `h-10`" has to reconstruct
something that no longer exists; reading "**the toggle must be `h-10` (40px); a 28px chip is only the
visual**" is directly actionable.

Keep each file short enough to be read in full. When you fix something a future agent could plausibly
hit, also leave a one-line comment at the fix site — the agent file explains the rule, the comment
explains that specific line.

Update **the file that owns the domain**:

| Change | Where to record it |
|---|---|
| Add/move/rename a file, module or route | §4 Architecture map here, **and** the domain file that describes it |
| Add or rename a `localStorage` key | [`.agents/state.md`](./.agents/state.md) registry |
| Add a new Steam API field or endpoint | [`.agents/steam.md`](./.agents/steam.md) |
| Hit a non-obvious framework/library bug | [`.agents/sveltekit.md`](./.agents/sveltekit.md) gotchas |
| Add or change a component, style, animation or perf rule | [`.agents/ui.md`](./.agents/ui.md) |
| Add a game-data field, type, difficulty or script | [`.agents/gamedata.md`](./.agents/gamedata.md) |
| Add a reusable pattern | the domain file it belongs to (framework, state, or UI) |
| Change a constraint or rule | the relevant file in this table |

Update **`README.md`** — rarely. It is written for a **Steam player who wants to finish a game**, not for
someone working in the codebase:

| Change | Where to record it |
|---|---|
| Add a user-visible feature | § What it does, if it isn't already implied |
| Add or remove a game | § The catalogue table |
| Change how you install and run it | § Running it yourself |
| Change the framework in a way a player would notice | one clause |
| Add/move/rename a file, route, script or component | **nothing** — that is the agent docs' job |
| Framework gotcha, schema change, script flag | **nothing** — the owning domain file |

The README deliberately has **no project-structure tree, no scripts table, and no deploy config**. A
structure tree goes stale the moment a file moves and duplicates §4 of this file. If you want to add one
back, put it in §4 instead.

### The two are not the same thing

- **`AGENTS.md` + `.agents/`** = rules, traps, architecture. Reader: you, in six months.
- **README** = what the app does and how to run it. Reader: a player deciding whether to use it.

A framework gotcha belongs in `.agents/sveltekit.md` and **nowhere else**. The README's
contributing section links to the agent docs instead of restating rules — if a rule appears in both,
one of them will go stale.

## 2. Routing: which domain file do I need?

| File | Owns | Read it when you are… |
|---|---|---|
| `AGENTS.md` (this one) | stack, cross-cutting constraints, code style, verification, documentation duty | **always** |
| [`.agents/sveltekit.md`](./.agents/sveltekit.md) | `vite.config.ts`, `tsconfig.json`, `#lib` imports, routing, `+page.server.ts` / `+server.ts`, navigation APIs, hydration, reactivity patterns | touching routing, config, server loads, `goto`, SSR/client mismatches, `svelte-check` errors |
| [`.agents/ui.md`](./.agents/ui.md) | `#lib/components/*`, `src/app.css`, Tailwind, the background pattern, mobile bar, trophy card, progress bars, icons, animation, performance, tap targets | changing anything a user sees or touches |
| [`.agents/steam.md`](./.agents/steam.md) | `#lib/server/steam/api.ts`, `/api/steam/*`, `#lib/types/steam.ts`, XML parsing, icon scraping, Cloudflare blocks, when Steam may be called | touching Steam calls, sync, avatars, or achievement statuses |
| [`.agents/state.md`](./.agents/state.md) | `platworks:*` localStorage keys, `#lib/client/profile.ts`, `#lib/client/library.ts`, `#lib/client/theme.ts`, the user library, sort/filter prefs, the six colour palettes, hydrating stored values | adding, renaming or reading persisted state |
| [`.agents/gamedata.md`](./.agents/gamedata.md) | `src/lib/data/games/*.json`, `schema.json`, guides, warnings, `mapUrl`, difficulty/types, icon scripts | adding or editing a game's achievement data |
| [`.agents/commits.md`](./.agents/commits.md) | Conventional Commits, English-only messages, type/scope vocabulary | creating or amending commits / writing commit messages |

Typical combinations:

| Task | Read |
|---|---|
| A UI bug on the game page | this + UI + SvelteKit (if it involves ordering/hydration) |
| A control that does not respond to clicks | this + UI §6 — a geometry audit cannot see a dead control |
| Sync returns no achievements | this + Steam |
| A new page or route | this + SvelteKit (+ UI if it renders anything) |
| Sort/filter does not persist | this + State + SvelteKit |
| Adding a new game | this + Gamedata, then run the icon scripts |
| `/generate-game-data` spamming URLs or inventing steps | this + Gamedata §2b (triage + fetch ledger) |
| A new UI feature, redesign or restyle | this + UI, then run `/ui-project` — it gates on mockups before code |
| A framework/build error | this + SvelteKit |
| Creating a git commit | this + Commits |

Reading a domain file you don't need costs context and buries the rules that do apply. Start with the
table, then open only the matching files.

## 3. Tech stack

| Package | Version | Notes |
|---|---|---|
| `@sveltejs/kit` | 3.x | API differs from v2 — see [`.agents/sveltekit.md`](./.agents/sveltekit.md) §1 |
| `svelte` | 5.56 | Runes mode is forced via `compilerOptions.runes` |
| `vite` | 8.x | Uses Rolldown |
| `tailwindcss` | 4.x | CSS-first `@theme`, no `tailwind.config.js` |
| `typescript` | 6.x | `strict: true` |

- **Icons:** only `@lucide/svelte`
- **Styling:** Tailwind utility classes; dark-first
- **Steam access:** server-only, never from the client

## 4. Architecture map

**Import alias is `#lib`, NOT `$lib`.** `$lib` does not exist in SvelteKit 3.

| Layer | Location | Purpose |
|---|---|---|
| Types | `#lib/types/` | `game.ts` → `GameData`, `Achievement`, `AchievementGuide`; `steam.ts` → `SteamGameDetails`, `SteamAchievementStatus`, `SteamProfile` |
| Steam API | `#lib/server/steam/api.ts` | server-only: `getGameDetails()`, `resolveSteamId()`, `getPlayerProfile()`, `getPlayerAchievements()`, `normalizeName()` |
| Game loader | `#lib/server/games.ts` | `getAllGames()`, `getGameByAppId()` via `import.meta.glob('#lib/data/games/[0-9]*.json')` |
| Icon tooling | `scripts/` | `fetch-game-images.mjs` (mirrors header + hero into `static/images/games/{appId}/`), `fetch-achievement-icons.mjs` (writes remote `iconUrl`), `verify-achievement-icons.mjs` (audits icons). Run with `node`, not npm |
| Agent toolkit | `scripts/agent/` | Reusable scripts for agent tasks, committed so they are never rewritten per run: `ui-audit.mjs` (the browser audit below), `shot.mjs` + `new-mockup.mjs` (mockups), `readme-shots.mjs` (regenerates `docs/screenshots/`), `steam-achievements.mjs` + `ledger.mjs` + `check-links.mjs` (game data), `make-icons.mjs` (regenerates the PWA PNGs), `pwa-check.mjs` (proves install + offline in a real browser). See [scripts/agent/README.md](scripts/agent/README.md). **A scratch file that will be needed again belongs here, not in `.tmp/`** |
| Agent rules | `AGENTS.md` + `.agents/*.md` | the project's memory: cross-cutting rules, architecture map, and one file per domain. Adapters for each AI tool live in `.github/`, `.cursor/`, `.claude/` and `.opencode/` and must stay thin — see §9 |
| Game artwork | `static/images/games/{appId}/` | committed `header.jpg` + `hero.jpg`, served from `/images/games/...`. The app never requests Steam's CDN for these; achievement icons are the deliberate exception |
| Client profile cache | `#lib/client/profile.ts` | `loadProfile()`, `saveProfile()`, `clearProfile()`, `refreshProfile()` |
| Client user library | `#lib/client/library.ts` | `loadLibrary()`, `saveLibrary()`, `addToLibrary()`, `removeFromLibrary()`, `clearLibrary()` — appIds only, owns `platworks:library` |
| Colour theme | `#lib/client/theme.ts` + `#lib/components/theme_picker.svelte` | six palettes in `app.css` as `[data-theme]` blocks, each a hue-cast surface ramp + a distinct `--pw-accent` primary; applied pre-paint by an inline script in `src/app.html`, owns `platworks:theme`. `THEMES` **duplicates** each palette's colours for the picker preview — a palette edit must update both |
| Background pattern | `src/app.css` + `src/routes/+layout.svelte` | the tilted 135px SVG `<pattern>` tile behind the app. Two inks per palette; `.pw-quiet` masks it out of the filter rows. Geometry and the traps that hide it live in [`.agents/ui.md`](./.agents/ui.md) §3 |
| Components | `#lib/components/` | `achievement_row` (row below `lg`, card in the desktop grid), `achievement_meta` + `achievement_guide` (shared by the row and the panel), `trophy_panel` (the game page's desktop master–detail panel), `game_card`, `game_filters`, `github_icon`, `mobile_bar`, `theme_picker`, plus the shared primitives `progress_bar` / `progress_ring` / `stat_tile` / `segmented_control` / `search_field` / `action_button` / `difficulty_pips` / `filter_toolbar` / `filter_group` — **use these instead of hand-rolling a control** |
| Pre-paint script | `src/app.html` | inline, synchronous: applies the stored palette and loads the webfonts before first paint. Moving either into Svelte causes a flash. The font list must cover every `--pw-font-display` in `app.css` — Orbitron (Cyberpunk) and JetBrains Mono (Matrix) |
| Boot screen | `src/app.html` (markup + inline `<style>`) and `#lib/client/boot.ts` (the driver) | covers the gap between "HTML parsed" and "Svelte mounted", which is the only blank frame in the app. Inline because app.css is a **render-blocking** `<link>` — a boot screen styled only by it would paint unstyled. Its six palettes are **copied** from app.css; edit both or the screen shows Ember while the app shows something else. Phases are real milestones only (`parse` → `mount` → `ready`), never invented copy. Both traps — the `<head>` element-lookup and the child-before-parent effect order — are documented at the call site |
| Service worker | `src/service-worker/index.ts` | bundled to `/service-worker.js` and registered automatically. Owns the offline story — the per-request cache policies and the `ignoreVary` trap live in its header comment; read it before changing anything about caching. Type-checked separately by `tsconfig.service-worker.json`, since the app tsconfig excludes it |
| PWA manifest | `static/manifest.json` | installability: raster icons, `display: standalone`, and `theme_color`/`background_color` pinned to the Ember `--pw-bg` so the splash does not flash a different colour |
| PWA icons | `static/icon.svg` (source), `static/icon-{192,512}.png`, `icon-maskable-{192,512}.png`, `apple-touch-icon.png` | the SVGs are the editable source; the PNGs are generated by `scripts/agent/make-icons.mjs` and must be regenerated when an SVG changes (`--check` fails the review). The manifest carries **only** the PNGs — see the maskable note in `make-icons.mjs`. Centring is **measured, not eyeballed**: `--check` also runs `scripts/agent/lib/png_instrument.py`, which fails if any tile's ink is off-centre or a maskable one escapes the 80% safe circle |
| Offline page | `static/offline.html` | answered for a navigation that has no network and no cached page. Deliberately plain HTML+CSS, not a Svelte route: it has to render before any bundle has loaded |
| Game data | `#lib/data/games/{appId}.json` | per-game achievement guides |
| Game-data scratch | `.tmp/game-data/{appId}/` | gitignored; fetch `ledger.json` + `findings.jsonl` + the parsed `achievements.json`. Repo-local on purpose — Windows + WSL must see the same path. Deleted when the run finishes; see [`.agents/gamedata.md`](./.agents/gamedata.md) §2b |
| UI mockup scratch | `.tmp/ui/{slug}/` | gitignored; standalone HTML per proposition + `notes.md` + `shots/`. Repo-local for the same Windows/WSL reason. **Never deleted without asking** — see [`.github/prompts/ui-project.prompt.md`](.github/prompts/ui-project.prompt.md) |
| README screenshots | `docs/screenshots/` | committed PNGs referenced by `README.md`. **Regenerate with `node scripts/agent/readme-shots.mjs` before committing any visible change** — nothing in the build does it for you, and stale binaries are invisible in review. See [`.agents/ui.md`](./.agents/ui.md) §6 |
| Layout | `src/routes/+layout.svelte` | navbar + account popover + the background pattern layer; owns `platworks:steamId` |
| Routes | `src/routes/` | `/` library · `/game/[appId]` detail · `/api/steam/sync/[appId]` · `/api/steam/profile` · `/linktest` |

## 5. Svelte 5 Runes rules

- ALWAYS use Runes: `$state`, `$derived`, `$derived.by`, `$props`, `$effect`, `$bindable`
- NEVER use Svelte 4: no `$:`, no `export let`, no `$store` auto-subscriptions
- Props: `let { a, b } = $props()`; bindable props: `let { value = $bindable('') } = $props()`
- Use `$state` for reactive locals, `$derived` for computed values, `$effect` only for real side effects
- Initialise from localStorage via a `load*()` function guarded by `if (!browser) return …`, never at module scope
- Patterns beyond this list (the `hydrated` gate, pre-computed maps) are in [`.agents/sveltekit.md`](./.agents/sveltekit.md)

## 6. Constraints

- DO NOT use Svelte 4 syntax
- DO NOT use inline styles when Tailwind utilities exist
- DO NOT read/edit/expose `.env` — reference `.env.example`
- DO NOT expose Steam API keys on the client — all Steam calls go through `+server.ts` / `+page.server.ts`
- DO NOT skip types — define interfaces for every Steam response and data model
- DO NOT import icons from anywhere but `@lucide/svelte`
- DO NOT leave unused imports or dead state after a refactor
- DO NOT fork a shared component to change one page — extend its props

## 7. Verifying your work

```bash
npm run check   # svelte-kit sync + svelte-check — the source of truth
npm run dev
```

**Environment notes (this repo runs in WSL):**

- `npx` is not on `PATH` by default. Prefix commands with:
  `export PATH=/home/florent/.nvm/versions/node/v24.12.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`
- Prefer the project's npm scripts; they already handle `svelte-kit sync`.
- **The VS Code TypeScript server goes stale after `tsconfig.json` changes** and reports phantom errors
  like "file not found" for files that exist. Trust `npm run check` over editor diagnostics, and re-run
  `svelte-kit sync` after tsconfig edits.
- Smoke-test with `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/<route>`.
- **Playwright + Chromium work here.** They need these system libs, installed once as root:
  `wsl -d Ubuntu -u root -- apt-get install -y libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64`
- `playwright` is **not** a project dependency, so `import { chromium } from "playwright"` fails. Never
  hardcode the npx-cache path to work around it — the `<hash>` changes whenever the cache is pruned, and
  a script with a baked-in path breaks weeks later with a `Cannot find module`. Import
  `scripts/agent/lib/playwright.mjs` instead: it resolves the newest install and, when there is none,
  fails with the one command that fixes it
  (`npx -y playwright@latest install --with-deps chromium`).
  - **`curl` cannot see UI defects.** `scripts/agent/ui-audit.mjs` does: it loads every route at
    phone 390 / tablet 768 / desktop 1440 / ultrawide 2560 and asserts no horizontal overflow,
    one copy of each control, no interactive element
    under 40px and no console errors, then writes the screenshots you have to actually look at. Add
    `--checks <file>` to assert the controls *respond* — a geometry audit cannot see a dead control. See
    [`.agents/ui.md`](./.agents/ui.md) §6 and [scripts/agent/README.md](scripts/agent/README.md).
- **Do not write a throwaway audit script.** If a check this repo needs is missing, add it to
  `scripts/agent/` and commit it — the whole point is that the next run does not re-derive it. `.tmp/`
  is for *output* (mockups, ledgers, screenshots), never for a script that will be needed again.
  Inline `node -e` through the PowerShell→WSL quoting chain is not worth attempting either way.
- `@vercel/analytics` is **not installed and not used** — do not re-add it. Its latest stable declares a
  peer range of Kit 1 or 2 only, so it cannot be installed on Kit 3 without `--legacy-peer-deps`.
- **Every file in this repo uses CRLF line endings and there is no `.gitattributes`.** `git status`
  therefore shows whole files as rewritten. Use `git diff --ignore-cr-at-eol` to see real changes, and
  normalise line endings back to CRLF after editing.

## 8. Code style

- `snake_case` files, `PascalCase` components, `camelCase` variables/functions
- Prefer `const` and `$derived` over mutable state
- Dark-first. Use the palette tokens (`steam-dark/blue/light/accent/green`, `ink`, `ink-dim`, `ink-faint`,
  `line`) rather than Tailwind's `gray-*` ramp, so text follows the active theme.
- Group classes: layout → spacing → sizing → colors → typography → effects
- **Never touch source files from PowerShell with `Set-Content`/`Get-Content`.** They default to a
  non-UTF-8 codepage: reading em-dashes and ellipses as Latin-1 and re-saving as UTF-8 silently
  double-encodes them, and `Set-Content -Encoding UTF8` prepends a BOM. `npm run check` will not catch it
  — it looks like correct source. Use the `edit` tool, or write files from WSL. If it has already
  happened, the fix is a byte-level re-decode, not `replace`.

## 9. Where these rules live (the adapter rule)

`AGENTS.md` and `.agents/*.md` are **the only place a rule is ever written.** Every other AI file in
this repo is a **thin adapter**: a few lines that tell a specific tool where the real rules live, in
the format that tool's native loader expects.

This is the one rule that keeps the setup from rotting. An adapter that restates a rule is a rule with
two sources of truth, and the copy that nobody updates is the one the next agent believes.

| Tool | Reads natively | Adapter lives in |
|---|---|---|
| **Copilot / VS Code** | `AGENTS.md`, then `.github/instructions/*.instructions.md` matched by `applyTo` glob | `.github/` |
| **Cursor** | `AGENTS.md`, then `.cursor/rules/*.mdc` matched by `globs` / `alwaysApply` | `.cursor/` |
| **Claude Code** | `AGENTS.md`, `CLAUDE.md`, then `.claude/agents/*.md` subagents | `.claude/` |
| **OpenCode** | `AGENTS.md` natively, then `.opencode/commands/*.md` slash commands and `.opencode/agents/*.md` subagents | `.opencode/` |
| **Codex CLI / any AGENTS.md-aware tool** | `AGENTS.md` alone — no adapter needed | — |

**When you learn a new rule:** write it in `AGENTS.md` or the matching `.agents/` file. Never in an
adapter. If a tool genuinely needs a rule the others must not see (a sandbox permission, a tool-name
list), it belongs in that tool's own config — `.claude/settings.json`, `.opencode/opencode.json`, the `tools:` frontmatter of a
`.github/instructions/*.instructions.md` file — and nowhere else.

**When you add a domain:** add `.agents/<domain>.md`, then add one adapter line per tool. If a tool
needs no adapter because `AGENTS.md` §2 already routes it, add none.

See [`.agents/README.md`](./.agents/README.md) for the adapter templates and the per-tool frontmatter
each loader requires.
