---
description: "Use when touching SvelteKit 3 or build config in PlatWorks: routing, +page.server.ts, +server.ts, #lib imports, tsconfig, $app/*, navigation, hydration, or svelte-check failures."
tools: [read, edit, search, execute]
---

# PlatWorks — framework layer (SvelteKit 3 + build)

**You own:** `vite.config.ts`, `tsconfig.json`, `package.json` `imports`, routing and `+page.server.ts` / `+server.ts` files, navigation APIs, SSR-vs-client hydration, and Svelte reactivity patterns.

**Always paired with:** [AGENTS.md](../AGENTS.md) (the rules that apply everywhere). Pair with [ui.md](./ui.md) when the change is visual, or [state.md](./state.md) when a `localStorage` value drives the order you are rendering.

---

## 1. SvelteKit 3 gotchas & traps

SvelteKit 3's API differs from v2 in ways that are easy to get wrong. These are the traps:

| Trap | Detail |
|---|---|
| **`svelte.config.js` must not exist** | Its presence is a hard `config_file_unsupported` error, not a warning. Config goes in `vite.config.ts` → `sveltekit({ adapter, compilerOptions })`. `adapter` is **top-level**, no `kit: {}` wrapper. Options SvelteKit doesn't claim are forwarded to `vite-plugin-svelte` (that is where `compilerOptions` lands) |
| **`adapter-auto` is not used** | The target is **Vercel** and it is pinned as `@sveltejs/adapter-vercel` in `vite.config.ts`. Do not reintroduce `adapter-auto` "because it is the default": on Vercel it detects the platform from `process.env.VERCEL`, then runs `npm install` of the adapter **during the build**, which mutates `package.json` and needs a network round-trip. A pinned adapter is faster, deterministic, and configurable |
| **`$lib` does not exist** | Use `#lib`. It needs **both** the `imports` field in `package.json` *and* a mirrored `paths` entry in `tsconfig.json` — Vite resolves from the former, TypeScript from the latter. Missing the mirror produces a large number of phantom type errors while the app runs fine |
| **`$app/environment` does not exist** | Use `$app/env` (exports `browser`, `dev`, `building`, `version`) |
| **`tsconfig.json` extends `$app/tsconfig`** | Not `./.svelte-kit/tsconfig.json`. The base lives at `node_modules/$app/tsconfig.json` and ships `paths: {}` — SvelteKit generates no lib path, so you must supply it |
| **`goto()` options were renamed** | `replaceState`→`replace`, `invalidateAll`→`refreshAll`; `noScroll`+`keepFocus` collapsed into a single `reset` flag |
| **Shallow `goto` still fires `onNavigate`** | `goto(url, { shallow: true })` calls `_before_navigate()` internally, so `onNavigate` runs and the View Transition plays. For "update the URL only" use the **deprecated** `replaceState(url, state)` from `$app/navigation` — it is the one API that skips the navigation hooks. It logs a one-time dev warning; that is the accepted cost |
| **Per-keystroke navigation** | Never call `goto()` from an `oninput` handler. Besides animating, it can re-run `+page.server.ts` (the library `load` fetches Steam details for every game) |
| **`#lib/server/*` in a component fails the build** | A page that imports a server-only module fails with `SvelteKit error: server_only_import`. The SSR build succeeds first, so the log **looks** like a successful build until the client environment errors — always check the exit code, not the chunk listing. Move the lookup into `+page.server.ts` and take the data via `data` props. A scratch/debug page is still a route: it ships with the app |

## 1a. Reading a build log that "succeeded"

Kit 3 builds the SSR environment first and the client second. A truncated log or a
scrollback cut at the server chunks is the classic signature of a **client-only
failure**: the server output looks complete, then

```
✗ Build failed
[plugin vite-plugin-sveltekit-guard]
SvelteKit error: server_only_import
```

If the log ends at `.svelte-kit/output/server/...` with no `output/client/` listing
and no `✓ done`, the build did not finish. Confirm with `echo $?`, and confirm a
real client bundle exists under `.svelte-kit/output/client/_app/immutable/entry/`.

## 1b. Deployment

Deployed from the **Vercel web UI** (git push → auto build). No CI config in the
repo; Vercel runs `npm ci && npm run build` and consumes `.vercel/output`.

| Setting | Value |
|---|---|
| Framework preset | SvelteKit (auto-detected) |
| Build command | `npm run build` (default) |
| Install command | `npm ci` (default) |
| Output directory | `.vercel/output` — **do not override**; the adapter writes it |

`adapter-vercel` emits **Build Output API v3**: `output/static` for assets and
`output/functions/` for SSR plus each `+server.ts` route. A healthy build ends with
`Using @sveltejs/adapter-vercel` then `✔ done`, and `package.json` is **not**
modified during it — if it is, `adapter-auto` has crept back in.

`dotenv` is a dependency but nothing in `src/` reads `process.env`; Steam needs no
key. No environment variables are required on Vercel.

## 2. Routing and server loads

| Route | Kind | Purpose |
|---|---|---|
| `/` | `+page.svelte` + `+page.server.ts` | library grid; the server load fetches Steam details for **every** game |
| `/game/[appId]` | `+page.svelte` + `+page.server.ts` | achievement list, search, filters, bottom bar |
| `/api/steam/sync/[appId]` | `+server.ts` | one game's achievement statuses |
| `/api/steam/profile` | `+server.ts` | name + avatar |
| `/linktest` | `+page.svelte` + `+page.server.ts` | scratch page for inspecting link combinations in `achievement_row.svelte`. Temporary — **delete it (the directory, both files) once the inspection is done**; it is a real route and ships to production |

Adding a route means adding a row here and a row in §4 of
[AGENTS.md](../AGENTS.md). Nothing goes in the README — it carries no structure
tree.

## 3. Hydration: the `hydrated` gate

Svelte hydrates keyed `{#each}` blocks **positionally** and does not rewrite existing attributes. Any order that differs between SSR and the first client render (e.g. a sort read from `localStorage`) leaves stale `src`/text — this is what made game images appear shuffled after a reload.

Gate whenever SSR output and the first client render could disagree, i.e. anything from `localStorage` that affects **order or filtering**:

```ts
let hydrated = $state(false);
$effect(() => { hydrated = true; });
```

```svelte
{#if !hydrated}
  <div class="h-[90px] animate-pulse rounded-lg bg-steam-blue"></div>
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
- Never initialise from `localStorage` at module scope — go through a `load*()` helper guarded by `if (!browser) return …`. The registry of those helpers lives in [state.md](./state.md).

## 5. Verifying

`npm run check` (`svelte-kit sync && svelte-check`) is the source of truth. Details, including the WSL `PATH` export and the stale-VS-CS-TS-server caveat, are in [AGENTS.md](../AGENTS.md) §7.