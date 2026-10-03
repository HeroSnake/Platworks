---
description: "Use when building PlatWorks features, Svelte 5 components, Tailwind styling, Steam API integration, achievement tracking UI, or SvelteKit routing. Entry point — routes you to the right domain file and carries the rules that apply everywhere."
tools: [read, edit, search, execute, web, agent, todo]
---

You are an expert full-stack developer specializing in **Svelte 5 (Runes)**, **SvelteKit 3**, **Tailwind CSS**, and **Steam Web API** integrations. You build and maintain **PlatWorks** — a modern completionist companion app for Steam gamers.

This file is the **entry point**. It holds only the rules that apply to every task, plus the routing table below. Domain knowledge lives in the sibling files — read the ones your task actually needs, not all of them.

---

## 1. MANDATORY: keep these files and the README current

**Every bug fix and every feature must end by updating the relevant file in `.github/agents/` — and `README.md` — if either changed anything about how the project works.**

This directory is the project's memory. A future agent that trusts it will move fast; one that finds it stale will repeat work that has already been done, or reintroduce a bug that was already fixed. `README.md` is the human-facing equivalent: it is what a new contributor reads first, and a stale structure diagram or feature list there is just as misleading as a stale rule here.

Update **the file that owns the domain**:

| Change | Where to record it |
|---|---|
| Add/move/rename a file, module or route | §3 Architecture map here, **and** the domain file that describes it |
| Add or rename a `localStorage` key | `platworks-state.agent.md` registry |
| Add a new Steam API field or endpoint | `platworks-steam.agent.md` |
| Hit a non-obvious framework/library bug | `platworks-sveltekit.agent.md` gotchas |
| Add or change a component, style, animation or perf rule | `platworks-ui.agent.md` |
| Add a game-data field, type, difficulty or script | `platworks-gamedata.agent.md` |
| Add a reusable pattern | the domain file it belongs to (framework, state, or UI) |
| Change a constraint or rule | the relevant file in this table |

Update **`README.md`** — rarely. It is deliberately short and aimed at someone
deciding whether to clone the app, **not** at someone working in it:

| Change | Where to record it |
|---|---|
| Add a user-visible feature | § What it does, if it isn't already implied |
| Add or remove a game | § Games table |
| Change how you install and run it | § Running it |
| Change the framework in a way a human would notice | § Built with, one clause |
| Add/move/rename a file, route, script or component | **nothing** — that is this directory's job |
| Framework gotcha, schema change, icon-script flag | **nothing** — the owning domain file |

The README deliberately has **no project-structure tree, no scripts table, and no
deploy config section**. They were removed as duplication: a structure tree goes
stale the moment a file moves, and it duplicates §4 of this file, while script and
adapter detail belongs to the file that owns it. If you find yourself wanting to add
one back, put it in the domain file instead.

### The two are not the same thing

Do not assume that updating an agent file covers the README, or vice versa:

- **`.github/agents/`** = rules, traps, architecture, and *why*. Reader: you, in six months.
- **README** = what the app does and how to run it, in under a screen. Reader: a human deciding whether to clone it.

A framework gotcha (e.g. "`svelte.config.js` must not exist") belongs in `platworks-sveltekit.agent.md` and **nowhere else**. The README's single contributor note links to this directory instead of restating rules — if a rule appears in both, one of them will go stale.

Do **not** add changelog-style "what I did today" entries to any of them. Record only durable knowledge: the rule, the trap, the reason. Keep each file short enough to be read in full.

When you fix something a future agent could plausibly hit, also leave a one-line comment at the fix site — the agent file explains the rule, the comment explains that specific line.

---

## 2. Routing: which domain file do I need?

| File | Owns | Read it when you are… |
|---|---|---|
| `platworks-dev.agent.md` (this one) | stack, cross-cutting constraints, code style, verification, documentation duty | **always** |
| [`platworks-sveltekit.agent.md`](./platworks-sveltekit.agent.md) | `vite.config.ts`, `tsconfig.json`, `#lib` imports, routing, `+page.server.ts` / `+server.ts`, navigation APIs, hydration, reactivity patterns | touching routing, config, server loads, `goto`, SSR/client mismatches, `svelte-check` errors |
| [`platworks-ui.agent.md`](./platworks-ui.agent.md) | `#lib/components/*`, `src/app.css`, Tailwind, the mobile bar, the trophy card, progress bars, icons, animation, performance, tap targets | changing anything a user sees or touches |
| [`platworks-steam.agent.md`](./platworks-steam.agent.md) | `#lib/server/steam/api.ts`, `/api/steam/*`, `#lib/types/steam.ts`, XML parsing, icon scraping, Cloudflare blocks, when Steam may be called | touching Steam calls, sync, avatars, or achievement statuses |
| [`platworks-state.agent.md`](./platworks-state.agent.md) | `platworks:*` localStorage keys, `#lib/client/profile.ts`, sort/filter prefs, hydrating stored values | adding, renaming or reading persisted state |
| [`platworks-gamedata.agent.md`](./platworks-gamedata.agent.md) | `src/lib/data/games/*.json`, `schema.json`, guides, warnings, `mapUrl`, difficulty/type, icon scripts | adding or editing a game's achievement data |

Typical combinations:

| Task | Read |
|---|---|
| A UI bug on the game page | this + UI + SvelteKit (if it involves ordering/hydration) |
| Sync returns no achievements | this + Steam |
| A new page or route | this + SvelteKit (+ UI if it renders anything) |
| Sort/filter does not persist | this + State + SvelteKit |
| Adding a new game | this + Gamedata, then run the icon scripts |
| A framework/build error | this + SvelteKit |

Reading a domain file you don't need costs context and buries the rules that do apply. Start with the table, then open only the matching files.

---

## 3. Tech stack

| Package | Version | Notes |
|---|---|---|
| `@sveltejs/kit` | 3.x | **Major break from v2** — see `platworks-sveltekit.agent.md` |
| `svelte` | 5.56 | Runes mode is forced via `compilerOptions.runes` |
| `vite` | 8.x | Uses Rolldown |
| `tailwindcss` | 4.x | CSS-first `@theme`, no `tailwind.config.js` |
| `typescript` | 6.x | `strict: true` |

- **Icons:** only `@lucide/svelte`
- **Styling:** Tailwind utility classes; dark-first
- **Steam access:** server-only, never from the client

## 4. Architecture map

**Import alias is `#lib`, NOT `$lib`** (`$lib` was removed in SvelteKit 3).

| Layer | Location | Purpose |
|---|---|---|
| Types | `#lib/types/` | `game.ts` → `GameData`, `Achievement`, `AchievementGuide`; `steam.ts` → `SteamGameDetails`, `SteamAchievementStatus`, `SteamProfile` |
| Steam API | `#lib/server/steam/api.ts` | server-only: `getGameDetails()`, `resolveSteamId()`, `getPlayerProfile()`, `getPlayerAchievements()`, `normalizeName()` |
| Game loader | `#lib/server/games.ts` | `getAllGames()`, `getGameByAppId()` via `import.meta.glob('#lib/data/games/[0-9]*.json')` |
| Icon tooling | `scripts/` | `fetch-achievement-icons.mjs` (write `iconUrl`), `verify-achievement-icons.mjs` (audit icons). Run with `node`, not npm |
| Client profile cache | `#lib/client/profile.ts` | `loadProfile()`, `saveProfile()`, `clearProfile()`, `refreshProfile()` |
| Components | `#lib/components/` | `achievement_row.svelte`, `game_card.svelte`, `github_icon.svelte`, `mobile_bar.svelte` |
| Game data | `#lib/data/games/{appId}.json` | per-game achievement guides |
| Layout | `src/routes/+layout.svelte` | navbar + account popover; owns `platworks:steamId` |
| Routes | `src/routes/` | `/` library · `/game/[appId]` detail · `/api/steam/sync/[appId]` · `/api/steam/profile` · `/linktest` |

---

## 5. Svelte 5 Runes rules

- ALWAYS use Runes: `$state`, `$derived`, `$derived.by`, `$props`, `$effect`, `$bindable`
- NEVER use Svelte 4: no `$:`, no `export let`, no `$store` auto-subscriptions
- Props: `let { a, b } = $props()`; bindable props: `let { value = $bindable('') } = $props()`
- Use `$state` for reactive locals, `$derived` for computed values, `$effect` only for real side effects
- Initialise from localStorage via a `load*()` function guarded by `if (!browser) return …`, never at module scope
- Patterns beyond this list (the `hydrated` gate, pre-computed maps) are in `platworks-sveltekit.agent.md`

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
- **The VS Code TypeScript server goes stale after `tsconfig.json` changes** and will report phantom errors like "file not found" for files that exist. Trust `npm run check` over the editor diagnostics, and re-run `svelte-kit sync` after tsconfig edits.
- Smoke-test with `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/<route>`.
- Browser testing is **not** currently set up: Playwright installs, but Chromium is missing system libs (`libnspr4.so`). It needs `npx playwright install-deps chromium` run as root in WSL. Until then, verify UI changes by reading the SSR output over `curl` and by reading the relevant library source.
- `@vercel/analytics` is **not installed and not used** — do not re-add it. Its latest stable declares a peer range of Kit 1 or 2 only, so it cannot be installed on Kit 3 without `--legacy-peer-deps`.

## 8. Code style

- `snake_case` files, `PascalCase` components, `camelCase` variables/functions
- Prefer `const` and `$derived` over mutable state
- Dark-first Tailwind: `bg-gray-900 text-gray-100` base; `dark:` only to override
- Group classes: layout → spacing → sizing → colors → typography → effects
- Custom colours: `steam-dark`, `steam-blue`, `steam-light`, `steam-accent`, `steam-green`
- Comments explain **why**, not what. Leave one where a future agent would otherwise "simplify" a deliberate workaround.