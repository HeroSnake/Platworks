---
description: "Use when touching SvelteKit 3 or build config in PlatWorks: routing, +page.server.ts, +server.ts, #lib imports, tsconfig, $app/*, navigation, hydration, or svelte-check failures."
tools: [read, edit, search, execute]
---

# PlatWorks — framework layer (SvelteKit 3 + build)

**You own:** `vite.config.ts`, `tsconfig.json`, `package.json` `imports`, routing and `+page.server.ts` / `+server.ts` files, navigation APIs, SSR-vs-client hydration, and Svelte reactivity patterns.

**Always paired with:** [platworks-dev.agent.md](./platworks-dev.agent.md) (the rules that apply everywhere). Pair with [platworks-ui.agent.md](./platworks-ui.agent.md) when the change is visual, or [platworks-state.agent.md](./platworks-state.agent.md) when a `localStorage` value drives the order you are rendering.

---

## 1. SvelteKit 3 gotchas & traps

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

## 2. Routing and server loads

| Route | Kind | Purpose |
|---|---|---|
| `/` | `+page.svelte` + `+page.server.ts` | library grid; the server load fetches Steam details for **every** game |
| `/game/[appId]` | `+page.svelte` + `+page.server.ts` | achievement list, search, filters, bottom bar |
| `/api/steam/sync/[appId]` | `+server.ts` | one game's achievement statuses |
| `/api/steam/profile` | `+server.ts` | name + avatar |
| `/linktest` | `+page.svelte` | scratch page for manual checks; delete before shipping |

Adding a route means adding a row here and a line to the README structure tree.

## 3. Hydration: the `hydrated` gate

Svelte hydrates keyed `{#each}` blocks **positionally** and does not rewrite existing attributes. Any order that differs between SSR and the first client render (e.g. a sort read from `localStorage`) leaves stale `src`/text — this is what made game images appear shuffled after a reload.

Gate whenever SSR output and the first client render could disagree, i.e. anything from `localStorage` that affects **order or filtering**:

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

## 4. Reactivity patterns

- Runes only: `$state`, `$derived`, `$derived.by`, `$props`, `$effect`, `$bindable`. Never `$:`, `export let`, or `$store` auto-subscriptions.
- `$effect` only for real side effects (localStorage writes, DOM measurement), never for deriving a value.
- **Pre-compute maps** with `$derived.by` when a lookup is needed per row:

```ts
let achievedMap = $derived.by(() => new Map(Object.entries(achieved)));
```

  Calling a function per row re-parses or re-allocates on every keystroke; the map is built once per change.

- Props: `let { a, b } = $props()`; bindable: `let { value = $bindable('') } = $props()`.
- Never initialise from `localStorage` at module scope — go through a `load*()` helper guarded by `if (!browser) return …`. The registry of those helpers lives in [platworks-state.agent.md](./platworks-state.agent.md).

## 5. Verifying

`npm run check` (`svelte-kit sync && svelte-check`) is the source of truth. Details, including the WSL `PATH` export and the stale-VS-CS-TS-server caveat, are in [platworks-dev.agent.md](./platworks-dev.agent.md) §7.