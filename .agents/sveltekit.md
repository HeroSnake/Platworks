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
| **`$app/manifest` was renamed in Kit 3** | The published service-worker docs still show `build`, `files` and `version`. In Kit 3 the module exports **`immutable`** and **`assets`**, and `version` lives in **`$app/env`**. Both exports are arrays of `{ path }` **objects**, not strings — `map((e) => e.path)` before using them as URLs. Copying the documented snippet is a build error |
| **The service worker is a separate TS unit** | `tsconfig.json` excludes `src/service-worker/`, so `svelte-check` never sees it. `tsconfig.service-worker.json` extends `$app/tsconfig/service-worker` and is run by `npm run check:sw` (chained from `npm run check`). Kit's base config ships **without `strict`**, so it re-enables it explicitly. Without this, the worker is compiled but never type-checked |
| **SvelteKit's chunks load via dynamic `import()`** | There are no `<script src>` tags for the app entry — the inline bootstrap does `import('./_app/immutable/entry/start.*.js')`. So `document.querySelectorAll('script')` finds nothing, and a broken chunk graph leaves SSR'd markup painted but the app inert. Test interactivity by clicking, never by counting script tags |
| **Kit's service worker must not import `$app/forms` / `$app/navigation` / `$app/state`** | A build-time guard rejects them. `$app/service-worker`, `$app/env`, `$app/manifest` and `$app/paths` are the supported set |
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

## 2b. Offline and the service worker

The app is a PWA: `src/service-worker/index.ts` is bundled to `/service-worker.js`
and registered automatically (`serviceWorker.register` defaults to true). Cache
policy lives in that file's header comment — read it before changing anything
about caching. The three rules that are easy to get wrong:

| Rule | Why |
|---|---|
| **`cache.match` needs `ignoreVary: true`** | Vercel and `vite preview` answer with `Vary: Origin`. Precache entries are created in `install` with no `Origin` header, but SvelteKit loads its chunks via `import()` on a **cross-origin-mode** request that does send one — so every JS chunk silently misses the cache and falls through to the network. Offline, the SSR'd markup still paints (stylesheets have no `Origin` to disagree about) so it *looks* fine while the app is dead. `scripts/agent/pwa-check.mjs` asserts a card click still routes, which is the only honest test |
| **`/` is precached, and not atomically** | A page loaded before its worker activates is never intercepted, so on a first visit `/` never reaches `networkFirst` and is never cached. Without it in the precache, every cold start offline lands on `offline.html`. It is cached with `cache.add(...).catch()` rather than inside `addAll`, because `/` is SSR and calls Steam — a Steam outage must not block activation |
| **`/api/steam/*` is never cached** | It is achievement sync. A stale hit reports the wrong unlocked state as fact, which is worse than an error, and both call sites already degrade to an error message |

The precache deliberately excludes `static/images/games/**` (~11MB). Precaching
it would slow install enough that Chrome may never fire the install prompt, and
burn the origin quota on images the user may never open; artwork is cached on
demand instead.

There is deliberately **no `skipWaiting()`**: with no update prompt, the next
build's worker waits until every tab has closed, which is the only way to
guarantee a session never has its chunks swapped underneath it mid-navigation.
The cost is that a user who never closes their last tab stays on the old build.

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

### Child effects flush before parent effects

The gate above is also the mechanism the boot screen hangs off (`#lib/client/boot.ts`), and the ordering is load-bearing there: a route's `ready` milestone fires from its own `$effect`, and **Svelte runs child effects before parent effects**, so the route beats the layout. Measured, not assumed — on a cold load `ready` landed at 118ms and the layout's `mount` at 132ms, which would have retired the screen on its last phase and made the earlier one unreachable.

Two consequences to keep:

- **Never rely on a parent's effect running before a child's.** If a sequence has to be ordered, enforce it explicitly (the boot screen's inline script keeps a `reached` level and ignores regressions) rather than depending on flush order.
- **Module scope runs before any effect.** An imported module's top-level code fires when the bundle starts executing, which is strictly earlier than any component effect — that is why `bootPhase('mount')` lives at the bottom of `boot.ts` and not in `+layout.svelte`.

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

`npm run check` (`check:app` then `check:sw` — `svelte-check` for the app, `tsc`
for the service worker) is the source of truth. Details, including the WSL
`PATH` export and the stale-VS-CS-TS-server caveat, are in [AGENTS.md](../AGENTS.md) §7.

Offline and installability are **not** covered by either: a service worker only
exists in a browser, and offline only exists once the network is taken away. Build,
serve, then run:

```bash
npm run build && npm run preview &
node scripts/agent/pwa-check.mjs
```