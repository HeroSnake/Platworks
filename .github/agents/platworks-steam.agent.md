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
| `getGameDetails(appId, { hero? })` | name, short description, header, background, Metacritic |
| `resolveSteamId(input)` | vanity name / profile URL / ID → Steam64 |
| `getPlayerProfile(steamId64)` | name + avatar |
| `getPlayerAchievements(steamId64, appId)` | per-achievement `achieved` + `unlockTime` |
| `normalizeName(name)` | key used to join achievement names to other lists — strips the whole `["'‘’“”]` class rather than turning quotes into spaces |

No API key is used or required; everything goes through public Steam community endpoints.

### Store `appdetails` is often blocked from Node

`store.steampowered.com/api/appdetails` sits behind Akamai and frequently returns **Access Denied (403 HTML)** to server-side fetches. When that happens, `getGameDetails` **must not return `null`**: fall back to CDN artwork so the library still shows images.

```
https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appId}/header.jpg
```

Name / short description / Metacritic stay empty in that mode — callers use `steam?.name || game.name`. Do not leave `steam: null` just because the JSON API failed.

### `hero: true` is opt-in, and it is a HEAD probe

`appdetails` has no wide banner. The store hero is a separate asset:

```
https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appId}/library_hero.jpg
```

It is **1920x620**, versus `header_image`'s **460x215**. That ratio matters: the game page stretches the banner full-bleed, and 460x215 upscaled to ~900px wide is visibly soft.

Two things to know before using it:

- **It is not guaranteed to exist.** Roughly one game in twelve 404s, so `getHeroImage` returns `string | null` and callers must fall back to `headerImage`.
- **The probe is a `HEAD`, not free.** The library page calls `getGameDetails` for *every* game on load, so `hero` defaults to `false` and only `/game/[appId]` opts in. Do not flip the default without re-measuring the library's load time.

Steam also serves `page_bg_raw.jpg` (`background_raw`), which is enormous — a 33k-pixel panorama, ~1.3 MB. It is fine as a CSS page background and is what `background` resolves to; never put it in an `<img>`.

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

Traps, all of which have already cost time here:

- **Only the unlocked (coloured) icon is published.** There is no second URL — the locked look is a CSS `grayscale` of the same file. Do not go looking for `icon_closed`; it does not appear in the HTML. One URL per achievement is correct and complete.
- **The files are natively 64×64.** Confirmed by reading the JPEG SOF marker. There is no larger variant on this CDN, so 64px is the render ceiling — see [platworks-ui.agent.md](./platworks-ui.agent.md).
- **No API-name field.** The page has only `<h3>` display names, so rows must be joined to `Achievement.name`. Steam's apostrophes are curly (`Dead Man’s Chest`) while hand-written data usually has straight ones (`Dead Man's Chest`) — the normaliser must strip the whole quote class, or the two forms hash differently.
- **Reused art is real.** Several games publish one hash for multiple rows (Aniimo has 7, one shared by 4 achievements). A duplicated `iconUrl` is therefore not evidence of a matching bug — confirm against the raw page before "fixing" it.
- **A silent no-op is the dangerous case.** If a display name drifts, an unmatched entry must surface in the script's report. Never let a fuzzy fallback quietly assign a neighbouring trophy's art.

`iconUrl` is **optional** in the schema so a hand-added game still validates; `achievement_row.svelte` simply omits the `<img>` when it is absent.

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