---
description: "Use when touching persisted client state in PlatWorks: localStorage keys, the cached Steam profile, the user library, sort/filter preferences, colour themes, or hydrating a stored value into the first render."
tools: [read, edit, search, execute]
---

# PlatWorks — client state layer

**You own:** `platworks:*` localStorage keys, `#lib/client/profile.ts`, `#lib/client/library.ts`,
`#lib/client/theme.ts`, the user library, sort/filter preferences, and the rule for hydrating any stored
value into the first render.

**Always paired with:** [platworks-dev.agent.md](./platworks-dev.agent.md). Pair with
[platworks-sveltekit.agent.md](./platworks-sveltekit.agent.md) when a stored value changes **order or
filtering** — that triggers the `hydrated` gate. Pair with
[platworks-steam.agent.md](./platworks-steam.agent.md) when the Steam ID or the cached profile is
involved.

---

## 1. The registry

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
| `platworks:library` | `#lib/client/library.ts` | `number[]` of appIds — the player's own subset. See §5 |
| `platworks:theme` | `#lib/client/theme.ts` | palette id, validated against `THEMES` on read. See §6 |

**Trophy search is session-only** (`trophyQuery`) and is deliberately not persisted.

When you add, rename or remove a key, update this table in the same change.

## 2. Reading stored state safely

```ts
export function loadProfile(): StoredProfile | null {
  if (!browser) return null;               // never touch localStorage on the server
  const raw = localStorage.getItem(PROFILE_KEY);
  // …
}
```

- Guard every entry point with `if (!browser) return …`. Module-scope `localStorage` access throws during
  SSR.
- Initialise from storage inside the component with a `load*()` call, not a top-level initializer.
- Writes happen in `$effect`s or event handlers, never during render.
- **A loader must not throw.** A hand-edited or corrupt entry is handled by the loader — validate and
  return a safe default. Return a **new** value rather than mutating, so the caller can assign it
  straight back into `$state` and storage and state can never disagree.

## 3. Hydrating order and filters

A stored value that changes **order or filtering** makes the first client render differ from SSR. Svelte
hydrates keyed `{#each}` blocks positionally and does not rewrite existing attributes, so without a gate
the user sees stale content. Sort, filter and search state all fall under this; the gate implementation is
in [platworks-sveltekit.agent.md](./platworks-sveltekit.agent.md) §3.

## 4. The profile cache

`#lib/client/profile.ts` owns `loadProfile()`, `saveProfile()`, `clearProfile()`, `refreshProfile()`.

- The navbar renders **from cache, synchronously** — it never fetches on page load.
- `refreshProfile()` runs after a successful sync, once per sync-all run, and on explicit user refresh.
  Guard it with an `anyConnected` flag so a failed sync does not trigger a profile request, and so
  sync-all refreshes once rather than once per game.
- `refreshProfile()` writes the resolved Steam64 ID back to `platworks:steamId`, so a vanity name is
  resolved once.
- Steam's default avatar is an all-zero hash; the module returns `null` there so the UI falls back to an
  icon rather than rendering the placeholder. See [platworks-steam.agent.md](./platworks-steam.agent.md) §2.

## 5. The user library

`#lib/client/library.ts` owns `loadLibrary()`, `saveLibrary()`, `addToLibrary()`, `removeFromLibrary()`
and `clearLibrary()`. It stores **appIds**, not game objects — the catalogue already arrives from
`+page.server.ts`, so storing a copy of it would go stale the moment a game is edited.

Two rules this key exists to enforce:

- **Totals are measured against the player's subset, never the catalogue.** Every aggregate on the library
  page (game count, `completed/total`, percent, the mobile bar ring) derives from `scopedGames`, and so
  does **Sync All**.
- **`scope` is authoritative and is never coerced.** `scopedGames` is a plain `$derived`:
  `scope === 'mine' ? myGames : data.games`. `'mine'` with an empty library is a real state with a real
  empty view, not something to silently redirect away from — see
  [platworks-ui.agent.md](./platworks-ui.agent.md) §1.

## 6. The colour theme

`#lib/client/theme.ts` owns `THEMES`, `loadTheme()` and `saveTheme()`. Four rules that are not obvious
from the code:

- **The theme is applied by an inline script in `src/app.html`, before first paint — not by this module.**
  Applying it in the layout means Svelte hydrates first and every load flashes the default Ember palette
  before switching, which on a dark UI reads as a white flash. `+layout.svelte` therefore reads the theme
  back off `document.documentElement`, not out of `localStorage`: the DOM is what is on screen, and a
  second source of truth could disagree with it.
- **The validator list exists twice** — once in `theme.ts` (`THEMES`) and once as a literal array in the
  `app.html` inline script, which runs before this module is fetched. Both must list every palette.
- **Tokens are declared `@theme inline` in `app.css` as `var(--pw-*)` references**, so the ~114 existing
  `steam-*` class usages retheme from one `data-theme` attribute. Renaming a token would require touching
  every component; adding a palette must never require it.
- **There is a fourth registration point: `--pw-pattern-dash` and `--pw-pattern-trophy`.** The background
  pattern's tile reads them from the palette, so a palette without them does not error — it silently
  inherits the previous palette's pattern colours. This is the one addition to a palette that fails
  invisibly. See [platworks-ui.agent.md](./platworks-ui.agent.md) §3.
- **A fifth point is the picker's colour literals, and it is the one that will bite you.** Each `THEMES`
  entry carries `swatch`, `bg` and `success` copied from its `[data-theme]` block, because the picker has to
  show palettes that are *not* currently applied and a CSS variable cannot do that. Change `--pw-accent`
  in `app.css` and the tile keeps advertising the old colour until `THEMES` is updated. The stored value is
  the id, so this never invalidates a saved choice — it only makes the control lie about what it selects.

So: adding a palette means the `[data-theme]` block in `app.css`, an entry in `THEMES`, the validator
array in `app.html`, the two pattern inks, and the font link if it overrides `--pw-font-display`.

Store the palette **id**, not colours, so a palette can be reworked without invalidating anyone's saved
choice. That is what makes a palette changeable at all: reworking every hue is a routine edit precisely
because no stored value names a colour.
