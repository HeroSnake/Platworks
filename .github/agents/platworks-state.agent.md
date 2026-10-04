---
description: "Use when touching persisted client state in PlatWorks: localStorage keys, the cached Steam profile, sort/filter preferences, hydration of stored values, or the #lib/client/profile.ts module."
tools: [read, edit, search, execute]
---

# PlatWorks — client state layer

**You own:** `platworks:*` localStorage keys, `#lib/client/profile.ts`, sort/filter preferences, and the rule for hydrating any stored value into the first render.

**Always paired with:** [platworks-dev.agent.md](./platworks-dev.agent.md). Pair with [platworks-sveltekit.agent.md](./platworks-sveltekit.agent.md) when a stored value changes **order or filtering** — that triggers the `hydrated` gate.

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

**Trophy search is session-only** (`trophyQuery`) and is deliberately not persisted.

When you add, rename or remove a key, update this table in the same change.

## 2. Reading stored state safely

```ts
export function loadProfile(): StoredProfile | null {
  if (!browser) return null;               // never touch localStorage on the server
  const raw = localStorage.getItem(PROFILE_KEY);
  ...
}
```

- Guard every entry point with `if (!browser) return …`. Module-scope `localStorage` access throws during SSR.
- Initialise from storage inside the component with a `load*()` call, not a top-level initializer.
- Writes happen in `$effect`s or event handlers, never during render.

## 3. Hydrating order and filters

A stored value that changes **order or filtering** makes the first client render differ from SSR. Svelte hydrates keyed `{#each}` blocks positionally and does not rewrite existing attributes, so without a gate the user sees stale content — this is what made game images appear shuffled after a reload.

Sort, filter and search state all fall under this. The gate implementation is in [platworks-sveltekit.agent.md](./platworks-sveltekit.agent.md) §3; the affected surfaces are the library grid and the achievement list.

## 4. The profile cache

`#lib/client/profile.ts` owns `loadProfile()`, `saveProfile()`, `clearProfile()`, `refreshProfile()`.

- The navbar renders **from cache, synchronously** — it never fetches on page load.
- `refreshProfile()` is called after a successful sync, once per sync-all run, and on explicit user refresh. Guard it with an `anyConnected` flag so a failed sync does not trigger a profile request, and so sync-all refreshes once rather than once per game.
- `refreshProfile()` writes the resolved Steam64 ID back to `platworks:steamId`, so a vanity name is only resolved once.
- Steam's default avatar is an all-zero hash; the module returns `null` there so the UI falls back to an icon rather than rendering the placeholder. Details in [platworks-steam.agent.md](./platworks-steam.agent.md) §2.

## 5. The user library

`#lib/client/library.ts` owns `loadLibrary()`, `saveLibrary()`, `addToLibrary()`, `removeFromLibrary()` and `clearLibrary()`. It stores **appIds**, not game objects — the catalogue already arrives from `+page.server.ts`, so storing a copy of it would go stale the moment a game is edited.

Two rules this key exists to enforce:

- **Totals are measured against the player's subset, never the catalogue.** Without this, adding a game to the repo silently moves someone's completion percentage. Every aggregate on the library page (game count, `completed/total`, percent, the mobile bar ring) derives from `scopedGames`, and so does **Sync All** — syncing games the player does not own would waste Steam API calls.
- **An empty selection is not "zero games", it is "no choice yet"**, and the page falls through to the public catalogue. That is why `effectiveScope` is a `$derived` that coerces `'mine'` → `'all'` when `myLibrary` is empty: removing the last game cannot strand the player on a blank grid.

`loadLibrary()` validates and de-duplicates on read, because a hand-edited or corrupt entry must not throw during render. That is also why the module returns the new array rather than mutating — the page assigns the return value straight back into `$state`, so storage and state can never disagree.