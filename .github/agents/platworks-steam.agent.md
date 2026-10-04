---
description: "Use when touching Steam integration in PlatWorks: the steam/api.ts module, XML parsing, /api/steam/* routes, achievement sync, avatars, icon scraping, or Steam caching."
tools: [read, edit, search, execute, web]
---

# PlatWorks — Steam integration

**You own:** `#lib/server/steam/api.ts`, the `/api/steam/*` endpoints, `#lib/types/steam.ts`, icon scraping, and when Steam may be called at all.

**Always paired with:** [platworks-dev.agent.md](./platworks-dev.agent.md). Pair with [platworks-state.agent.md](./platworks-state.agent.md) when the Steam ID or cached profile is involved — that is where they are written.

Steam serves two different XML shapes. **Getting a tag name wrong returns `null`, not an error.**

---

## 1. Module surface

`#lib/server/steam/api.ts` (server-only — never import it from client code):

| Function | Purpose |
|---|---|
| `getGameDetails(appId, { hero? })` | name, short description, local header/hero paths, Metacritic |
| `resolveSteamId(input)` | vanity name / profile URL / ID → Steam64 |
| `getPlayerProfile(steamId64)` | name + avatar |
| `getPlayerAchievements(steamId64, appId)` | per-achievement `achieved` + `unlockTime` |
| `normalizeName(name)` | key used to join achievement names to other lists — strips the whole `["'‘’“”]` class rather than turning quotes into spaces |

No API key is used or required; everything goes through public Steam community endpoints.

### Game artwork is local — never reintroduce a CDN URL

`headerImage` and `heroImage` are **public paths under `/images/games/{appId}/`**, served from files committed to `static/images/games/{appId}/`:

| File | Size | Used by |
|---|---|---|
| `header.jpg` | 460×215 | library card |
| `hero.jpg` | 1920×620 | game page hero — **absent for some games** |

`scripts/fetch-game-images.mjs` owns those files. Run it after adding a game; it is idempotent and skips
what is already there. Three traps:

- **The obvious CDN path is a guess.** `shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appId}/header.jpg` serves most games, but Steam hosts others from a **content-hashed** directory (`/apps/4126040/bf9b76d2…/header.jpg`). Aniimo (4126040) and WARDOGS (1867240) are in that group, so the guess 404s for them however often it is retried. The script therefore resolves URLs from `appdetails` rather than composing them.
- **`appdetails` intermittently 403s from Node.** `getGameDetails` must still return a usable local path so the library keeps its images; name / short description / Metacritic simply stay empty in that mode and callers use `steam?.name || game.name`. Do not leave `steam: null`. A process-lifetime `detailsCache` still guards the *text* fields, so one 403 cannot blank every blurb.
- **Never add a remote `onerror` retry** for a header or hero. Artwork is local, so a failure means the game has no art on Steam — not that the first host was wrong. The components reveal a placeholder instead; see [platworks-ui.agent.md](./platworks-ui.agent.md) §1.

**Achievement icons are the deliberate exception** and still load from Steam: 1647 of them would add far too much to the repo. `scripts/fetch-achievement-icons.mjs` owns `iconUrl` and must keep writing remote URLs. Only `fetch-game-images.mjs` produces local paths.

`SteamGameDetails.background` does not exist and must not be added — a full-viewport image behind the
game page is invisible under the page's scrim and costs a request on every load.

### Store `appdetails` is often blocked from Node

`store.steampowered.com/api/appdetails` sits behind Akamai and frequently returns **Access Denied (403
HTML)** to server-side fetches. `getGameDetails` **must not return `null`** in that case: fall back to the
local artwork path so the library still shows images.

Name / short description / Metacritic stay empty in that mode — callers use `steam?.name || game.name`.

### `hero: true` is opt-in, and costs nothing

`appdetails` has no wide banner, so the hero is a separate local asset. It is **1920x620** versus
`header_image`'s **460x215**; that ratio matters, because 460x215 upscaled across a full-width banner is
visibly soft.

- **It is not guaranteed to exist.** Roughly one game in twelve has none on Steam, so the file is simply
  absent and the component's `onerror` reveals the placeholder. There is **no probe** — the client
  discovers a missing hero for free when the local file 404s, and a `HEAD` request would be an external
  call on every game page load.
- **`hero` still defaults to `false`** because the library page calls `getGameDetails` for every game and
  never renders a hero.

## 2. Profile XML — `https://steamcommunity.com/profiles/{steamId64}/?xml=1`

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

Case-insensitive, and will **not** match a tag that carries attributes (`<avatar position="0">`). If Steam adds attributes to a tag you need, extend the regex rather than working around it.

## 3. Achievement icons — the global stats page

`https://steamcommunity.com/stats/{appId}/achievements` is the **only** no-API-key source for trophy artwork and is the same list the IDs and names came from. It is plain HTML, not XML:

```html
<div class="achieveRow ">
  <div class="achieveImgHolder"><img src="https://shared.akamai.steamstatic.com/community_assets/images/apps/{appId}/{40-hex}.jpg" width="64" height="64" /></div>
  <div class="achieveTxtHolder">…
      <div class="achieveTxt"><h3>Display Name</h3><h5>Description</h5></div>
```

Traps:

- **Only the unlocked (coloured) icon is published.** There is no second URL — the locked look is a CSS `grayscale` of the same file. Do not go looking for `icon_closed`; it does not appear in the HTML. One URL per achievement is correct and complete.
- **The files are natively 64×64.** Confirmed by reading the JPEG SOF marker. There is no larger variant on this CDN, so 64px is the render ceiling — see [platworks-ui.agent.md](./platworks-ui.agent.md).
- **No API-name field.** The page has only `<h3>` display names, so rows must be joined to `Achievement.name`. Steam uses curly apostrophes (`Dead Man's Chest`) while hand-written data usually has straight ones — the normaliser must strip the whole quote class, or the two forms hash differently.
- **Reused art is real.** Several games publish one hash for multiple rows (Aniimo has 7, one shared by 4 achievements). A duplicated `iconUrl` is therefore not evidence of a matching bug — confirm against the raw page before "fixing" it.
- **A silent no-op is the dangerous case.** If a display name drifts, an unmatched entry must surface in the script's report. Never let a fuzzy fallback quietly assign a neighbouring trophy's art.

`iconUrl` is **optional** in the schema so a hand-added game still validates; `achievement_row.svelte` simply omits the `<img>` when it is absent.

**`iconUrl` stays a Steam CDN URL — do not localise these.** Game artwork (header, hero) is local in
`static/images/games/` for correctness, but there are 1647 icons and they would add far too much to the
repo. They are the one intentional external image dependency.

## 4. Cloudflare-blocked hosts

`www.trueachievements.com` returns **403 to every request from Node**, including full browser header sets — it is bot protection, not a missing User-Agent. No script in this repo can scrape it; per-achievement guide links have to be read through an agent with web access instead.

This is why `scripts/` has no guide-link fetcher: it cannot exist. The same block applies to `wiki.gg` and `fandom` (403), while Steam's own endpoints are fine. Treat "403 from a script" as *unverifiable*, not *dead* — see [platworks-gamedata.agent.md](./platworks-gamedata.agent.md) for the map-link rule.

## 5. Caching rule

**Never fetch profile data on page load.** The navbar reads `platworks:profile` synchronously and renders from cache. Refresh it only:

- after a successful game sync,
- after a sync-all run (once per run, **not** once per game),
- when the user explicitly connects/refreshes their ID.

`syncWithSteam` / `syncAllGames` call `refreshProfile(sid)` after a **successful** connection. Guard it with an `anyConnected` flag so a failed sync does not trigger a profile request, and so sync-all refreshes once rather than once per game.

The resolved Steam64 ID is written back over the user's original input so later syncs skip vanity resolution — details in [platworks-state.agent.md](./platworks-state.agent.md).

## 6. Endpoints

| Route | Method | Returns |
|---|---|---|
| `/api/steam/sync/[appId]` | GET | `{ connected, steamId, achievements }` — one game |
| `/api/steam/profile` | GET | `{ connected, steamId, profile }` — name + avatar |

Define an interface in `#lib/types/steam.ts` for every response shape (`SteamGameDetails`, `SteamAchievementStatus`, `SteamProfile`); do not inline response types in a route.

Steam keys, if ever added, belong in `.env` and are read server-side only — never expose them to the client.