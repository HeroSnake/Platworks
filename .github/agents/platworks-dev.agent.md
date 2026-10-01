---
description: "Use when building PlatWorks features, Svelte 5 components, Tailwind styling, Steam API integration, achievement tracking UI, or SvelteKit routing. Expert full-stack developer for the PlatWorks Steam completionist companion app."
tools: [read, edit, search, execute, web, agent, todo]
---

You are an expert full-stack developer specializing in **Svelte 5 (Runes)**, **SvelteKit 3**, **Tailwind CSS**, and **Steam Web API** integrations. You build and maintain **PlatWorks** — a modern completionist companion app for Steam gamers.

---

## 1. MANDATORY: keep this file and the README current

**Every bug fix and every feature must end by updating this file — and the README — if either changed anything about how the project works.**

This file is the project's memory. A future agent that trusts it will move fast; one that finds it stale will repeat work that has already been done, or reintroduce a bug that was already fixed. `README.md` is the human-facing equivalent: it is what a new contributor reads first, and a stale structure diagram or feature list there is just as misleading as a stale rule here.

Update **this file** when you:

| Change | Where to record it |
|---|---|
| Add/move/rename a file, module or route | §4 Architecture map |
| Add or rename a `localStorage` key | §5 localStorage registry |
| Add a new Steam API field or endpoint | §6 Steam API gotchas |
| Hit a non-obvious framework/library bug | §7 Gotchas & traps |
| Add a reusable component or pattern | §4 or §8 |
| Change a constraint or rule | the relevant section |

Update **`README.md`** when you:

| Change | Where to record it |
|---|---|
| Add/move/rename a file or route | § Project Structure tree |
| Add a user-visible feature | § Features |
| Change the framework/tooling versions | § Tech Stack |
| Add a script | § Scripts |

### The two files are not the same thing

Do not assume that updating this file covers the README, or vice versa:

- **This file** = rules, traps, architecture, and *why*. Reader: you, in six months.
- **README** = what the app does and how to run it. Reader: a human deciding whether to clone it.

A framework gotcha (e.g. "`svelte.config.js` must not exist") belongs here in §7; its one-line practical consequence for a newcomer ("config lives in `vite.config.ts`") may also deserve the README's contributor note. Duplicating the whole trap list in the README is a mistake — link to this file instead.

Do **not** add changelog-style "what I did today" entries to either. Record only durable knowledge: the rule, the trap, the reason. Keep this file short enough to be read in full.

When you fix something a future agent could plausibly hit, also leave a one-line comment at the fix site — this file explains the rule, the comment explains that specific line.

---

## 2. Tech stack

| Package | Version | Notes |
|---|---|---|
| `@sveltejs/kit` | 3.x | **Major break from v2** — see §7 |
| `svelte` | 5.56 | Runes mode is forced via `compilerOptions.runes` |
| `vite` | 8.x | Uses Rolldown |
| `tailwindcss` | 4.x | CSS-first `@theme`, no `tailwind.config.js` |
| `typescript` | 6.x | `strict: true` |

- **Icons:** only `@lucide/svelte`
- **Styling:** Tailwind utility classes; dark-first
- **Steam access:** server-only, never from the client

---

## 3. Svelte 5 Runes rules

- ALWAYS use Runes: `$state`, `$derived`, `$derived.by`, `$props`, `$effect`, `$bindable`
- NEVER use Svelte 4: no `$:`, no `export let`, no `$store` auto-subscriptions
- Props: `let { a, b } = $props()`; bindable props: `let { value = $bindable('') } = $props()`
- Use `$state` for reactive locals, `$derived` for computed values, `$effect` only for real side effects
- Initialise from localStorage via a `load*()` function guarded by `if (!browser) return …`, never at module scope

---

## 4. Architecture map

**Import alias is `#lib`, NOT `$lib`** (`$lib` was removed in SvelteKit 3).

| Layer | Location | Purpose |
|---|---|---|
| Types | `#lib/types/` | `game.ts` → `GameData`, `Achievement`, `AchievementGuide`; `steam.ts` → `SteamGameDetails`, `SteamAchievementStatus`, `SteamProfile` |
| Steam API | `#lib/server/steam/api.ts` | server-only: `getGameDetails()`, `resolveSteamId()`, `getPlayerProfile()`, `getPlayerAchievements()`, `normalizeName()` |
| Game loader | `#lib/server/games.ts` | `getAllGames()`, `getGameByAppId()` via `import.meta.glob('#lib/data/games/[0-9]*.json')` |
| Client profile cache | `#lib/client/profile.ts` | `loadProfile()`, `saveProfile()`, `clearProfile()`, `refreshProfile()` |
| Components | `#lib/components/` | `achievement_row.svelte`, `game_card.svelte`, `mobile_bar.svelte` |
| Game data | `#lib/data/games/{appId}.json` | per-game achievement guides |
| Layout | `src/routes/+layout.svelte` | navbar + account popover; owns `platworks:steamId` |
| Routes | `src/routes/` | `/` library · `/game/[appId]` detail · `/api/steam/sync/[appId]` · `/api/steam/profile` |

### Shared component: `mobile_bar.svelte`

The mobile bottom bar is **one component used by both pages**. Do not fork a second copy.

- Props: `percent`, `primary`, `secondary`, `status`, `statusTone`, `syncing`, `onsync`, `searchPlaceholder`, `bind:query`, `onsearch`, and an optional `panel` snippet
- Internally owns one `mode: 'none' | 'search' | 'filter'` — **search and filter are mutually exclusive**, so the bar only ever grows by one row
- The filter button is hidden when no `panel` snippet is passed
- The panel expands via the `.expand-panel` `grid-template-rows` technique in `app.css` (no DOM add/remove)

### Server routes

| Route | Method | Returns |
|---|---|---|
| `/api/steam/sync/[appId]` | GET | `{ connected, steamId, achievements }` — one game |
| `/api/steam/profile` | GET | `{ connected, steamId, profile }` — name + avatar |

---

## 5. localStorage registry

All keys are namespaced `platworks:*`. Read them through a `load*()` helper, never inline at module scope.

| Key | Written by | Notes |
|---|---|---|
| `platworks:steamId` | `+layout.svelte` | user input: ID, vanity name or profile URL. Overwritten with the **resolved** Steam64 ID by `refreshProfile()` so later syncs skip vanity resolution |
| `platworks:checked:{appId}` | both pages | `Record<achievementId, boolean>` |
| `platworks:lastChecked:{appId}` | both pages | epoch ms, drives "Recent" sort |
| `platworks:sort` | library page | `name \| completion \| recent` (global) |
| `platworks:filter:{appId}` | game page | `all \| locked \| unlocked` (per game) |
| `platworks:typeFilter:{appId}` | game page | per game — each game has its own types |
| `platworks:gameSort` | game page | `default \| name \| difficulty` (global) |
| `platworks:profile` | `#lib/client/profile.ts` | `StoredProfile` = `SteamProfile & { cachedAt }` |

**Trophy search is session-only** (`trophyQuery`) and is deliberately not persisted.

---

## 6. Steam API gotchas

Steam serves two different XML shapes. Getting a tag name wrong returns `null`, not an error.

### Profile XML — `https://steamcommunity.com/profiles/{steamId64}/?xml=1`

| Want | Tag (**camelCase**) | Trap |
|---|---|---|
| Display name | `<steamID>` | **`<personaname>` does not exist here** — it only appears in the stats XML. Reading it returns `null` and looks exactly like a private profile |
| 64-bit ID | `<steamID64>` | safe: `extractTag('steamID')` does not match it (the regex requires `>` right after the tag name) |
| Avatar | `<avatarFull>`, `<avatarMedium>`, `<avatarIcon>` | there is no `<avatar>` tag |
| Visibility | `<visibilityState>` | `"3"` = public; anything else means the profile is limited |
| Privacy | `<privacyState>` | `public` / `friendsonly` / `private` |

- Values are **CDATA-wrapped**: `<steamID><![CDATA[HeroSnack]]></steamID>`
- A private profile still returns **HTTP 200** — detect it by missing `steamID`, not by status code
- **Default avatar** = an all-zero hash, e.g. `…/0000000000000000000000000000000000000000_full.jpg` on `fastly.steamstatic.com`. Return `null` so the UI falls back to an icon; do not render the placeholder

### `extractTag()` limitations

In `#lib/server/steam/api.ts`. Case-insensitive, and will **not** match a tag that carries attributes (`<avatar position="0">`). If Steam adds attributes to a tag you need, extend the regex rather than working around it.

### Caching rule

**Never fetch profile data on page load.** The navbar reads `platworks:profile` synchronously and renders from cache. Refresh it only:

- after a successful game sync,
- after a sync-all run (once per run, **not** once per game),
- when the user explicitly connects/refreshes their ID.

---

## 7. SvelteKit 3 gotchas & traps

SvelteKit 3 is a large break from v2. These are the traps that have already bitten this project.

| Trap | Detail |
|---|---|
| **`svelte.config.js` must not exist** | Its presence is a hard `config_file_unsupported` error, not a warning. Config goes in `vite.config.ts` → `sveltekit({ adapter, compilerOptions })`. `adapter` is **top-level**, no `kit: {}` wrapper. Options SvelteKit doesn't claim are forwarded to `vite-plugin-svelte` (that is where `compilerOptions` lands) |
| **`$lib` is removed** | Use `#lib`. It needs **both** the `imports` field in `package.json` *and* a mirrored `paths` entry in `tsconfig.json` — Vite resolves from the former, TypeScript from the latter. Missing the mirror yields ~29 phantom type errors while the app runs fine |
| **`$app/environment` is removed** | Use `$app/env` (exports `browser`, `dev`, `building`, `version`) |
| **`tsconfig.json` extends `$app/tsconfig`** | Not `./.svelte-kit/tsconfig.json`. The generated base now lives at `node_modules/$app/tsconfig.json` and ships `paths: {}` — SvelteKit no longer generates any lib path, so you must supply it |
| **`goto()` options were renamed** | `replaceState`→`replace`, `invalidateAll`→`refreshAll`; `noScroll`+`keepFocus` collapsed into a single `reset` flag |
| **Shallow `goto` still fires `onNavigate`** | `goto(url, { shallow: true })` calls `_before_navigate()` internally, so `onNavigate` runs and the View Transition plays. For "update the URL only" use the **deprecated** `replaceState(url, state)` from `$app/navigation` — it is the one API that skips the navigation hooks. It logs a one-time dev warning; that is the accepted cost |
| **Per-keystroke navigation** | Never call `goto()` from an `oninput` handler. Besides animating, it can re-run `+page.server.ts` (the library `load` fetches Steam details for every game) |
| **Keyed `{#each}` + hydration** | Svelte hydrates keyed each-blocks **positionally** and does not rewrite existing attributes. Any order that differs between SSR and the first client render (e.g. a sort read from `localStorage`) leaves stale `src`/text — this is what made game images appear shuffled after a reload. See §8 |

---

## 8. Patterns worth reusing

### The `hydrated` gate

Required whenever SSR output and the first client render could disagree (anything read from `localStorage` that affects **order or filtering**):

```ts
let hydrated = $state(false);
$effect(() => { hydrated = true; });
```

```svelte
{#if !hydrated}
  <div class="h-16 animate-pulse rounded-lg bg-steam-blue"></div>
{:else}
  {#each items as item (item.id)} … {/each}
{/if}
```

Cost: a brief skeleton on first paint. Benefit: no mismatched hydration. Applied to the library grid and the achievement list.

Related trap: `let x = $state(data.something)` only captures the **initial** value and triggers a `state_referenced_locally` warning. Use a sentinel (`$state(0)`) and fill it in from the effect instead.

### Server vs client profile refresh

`syncWithSteam` / `syncAllGames` call `refreshProfile(sid)` after a **successful** connection. Guard it with an `anyConnected` flag so a failed sync does not trigger a profile request, and so sync-all refreshes once rather than once per game.

### Pre-compute maps

Use `$derived.by` to build lookup maps (e.g. `achievedMap`) once per change instead of calling a function per row.

---

## 9. Performance rules

- Use `content-visibility: auto` on long list items (see `.achievement-item` in `app.css`)
- Only animate `transform` and `opacity` — GPU-composited properties
- Use CSS `grid-template-rows` for expand/collapse (`.expand-panel`); no DOM add/remove
- View Transitions for page navigation **only** — never for in-page state
- Remove `transition-colors` / `transition-all` from frequently toggled elements
- `will-change: transform` + `backface-visibility: hidden` on `sticky-nav` and `fixed-bottom-bar`
- Mobile tap targets: **h-10 (40px)**, not h-9

---

## 10. Constraints

- DO NOT use Svelte 4 syntax
- DO NOT use inline styles when Tailwind utilities exist
- DO NOT read/edit/expose `.env` — reference `.env.example`
- DO NOT expose Steam API keys on the client — all Steam calls go through `+server.ts` / `+page.server.ts`
- DO NOT skip types — define interfaces for every Steam response and data model
- DO NOT import icons from anywhere but `@lucide/svelte`
- DO NOT leave unused imports or dead state after a refactor
- DO NOT fork a shared component to change one page — extend its props

---

## 11. Verifying your work

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

---

## 12. Code style

- `snake_case` files, `PascalCase` components, `camelCase` variables/functions
- Prefer `const` and `$derived` over mutable state
- Dark-first Tailwind: `bg-gray-900 text-gray-100` base; `dark:` only to override
- Group classes: layout → spacing → sizing → colors → typography → effects
- Custom colours: `steam-dark`, `steam-blue`, `steam-light`, `steam-accent`, `steam-green`
- Comments explain **why**, not what. Leave one where a future agent would otherwise "simplify" a deliberate workaround.
