---
description: "Use for any visual or component change in PlatWorks: Svelte components, Tailwind styling, layout, mobile bar, trophy card, progress bars, animations, performance, icons, and app.css."
tools: [read, edit, search, execute]
---

# PlatWorks — UI layer

**You own:** `#lib/components/*.svelte`, `src/app.css`, all Tailwind markup, the shared layout, animations and performance budgets.

**Always paired with:** [platworks-dev.agent.md](./platworks-dev.agent.md). Pair with [platworks-sveltekit.agent.md](./platworks-sveltekit.agent.md) when the change involves navigation or hydration (the `hydrated` gate lives there).

---

## 1. Components

| Component | Role |
|---|---|
| `progress_bar.svelte` | **the default progress indicator** — linear, `scaleX` fill, optional `label`. Used on cards, the game header and the library tiles |
| `progress_ring.svelte` | ring, reserved for the few numbers that deserve ceremony (library total, game header). Never on a card |
| `stat_tile.svelte` | a headline figure with a label. Replaced the muted grey span line that used to carry every total |
| `segmented_control.svelte` | single-choice radio group; scrollable rather than wrapping. Used for scope, sort and the completion filter |
| `search_field.svelte` | the app's only search input. Both pages and the mobile bar use it |
| `action_button.svelte` | primary/secondary button with `loading`. Sync was copy-pasted with three class strings before this |
| `difficulty_pips.svelte` | 1-4 filled pips + label. Difficulty must never be hue-only |
| `game_filters.svelte` | the game page's **entire** filter row, rendered once at every breakpoint |
| `theme_picker.svelte` | six-palette swatch radio group, inside the account popover |
| `achievement_row.svelte` | expandable trophy card: toggle + Steam icon + badges + pips |
| `game_card.svelte` | compact card: 16:9 artwork, title, linear bar, count. No ring |
| `github_icon.svelte` | inline GitHub mark |
| `mobile_bar.svelte` | shared bottom bar for **both** pages |
| `src/routes/+layout.svelte` | navbar, account popover, View Transitions; owns `REPO_URL` and `platworks:steamId` |

### Render a filter ONCE, not once per breakpoint

The game page's filters lived in the page body *and* inside the mobile bar's `panel` snippet, each hidden at the opposite breakpoint. The measured result:

| | completion filter | type select | sort select | map link |
|---|---|---|---|---|
| mobile 390px | **2** | **2** | **2** | 1 |
| tablet 768px | 1 | 1 | 1 | **2** |

Two copies of a control drift, and these had already drifted into different heights, labels and option sets. `game_filters.svelte` now holds the whole filter row and is rendered **once, unconditionally**, at every width — `overflow-x-auto` keeps it one row and makes the extras reachable by swiping.

Three rules follow from that:

- **Do not re-add a `panel` snippet to either page's `mobile_bar`.** Neither page passes one, so the bar carries progress, search and sync only and its filter button hides itself. Sort and the game filters both live in the page at every breakpoint — one control surface per page, not one per breakpoint.
- **The library toolbar is ONE row: scope → search → sort → sync.** Scope was briefly its own block above the rest, which stretched it the full page width, because `display:flex` fills a block parent. As a flex item it shrink-wraps. `segmented_control.svelte` now carries `w-fit shrink-0` so it looks the same in either container — do not drop those.
- **Never hide a control at one breakpoint and re-render it at another.** If it must exist in two places, that is a sign it should be one component with a `hidden` class, or one component rendered once.
- **Search is the one control allowed to differ per breakpoint** (`hidden sm:block` in both the library toolbar and `game_filters.svelte`), because the mobile bar owns it on a phone. One search box per breakpoint, never both.

### Tap targets: `h-9` is 36px, not 40px

`h-9` = 2.25rem = **36px** and fails the 40px floor. The audit in §6 catches these; the ones that were wrong:

| Control | Was | Now |
|---|---|---|
| `game_card.svelte` library toggle | `h-7 w-7` (28px) | `h-10 w-10` hit area, 28px visual chip inside via a negative inset |
| `segmented_control.svelte` | `h-9` | `h-10` (both sizes) |
| `game_filters.svelte` selects + chips | `h-9` | `h-10` |
| navbar back / GitHub / account | 36px | 44px / 40px / 44px |
| `achievement_row.svelte` expand button | collapsed to **39.6px** on rows with an empty description | `min-h-10` |

That last one is the subtle case: the expand button sizes to its content, so a secret trophy with no description left only the title line and it fell under the floor. **A content-sized interactive element needs an explicit minimum.**

### Component rules

- **Do not hand-roll a control that already exists.** The old code carried a desktop `<input>` *and* a separate copy in the mobile bar, plus two different filter UIs — the exact drift these components exist to prevent.
- `progress_ring.svelte` and `progress_bar.svelte` both take `percent` and clamp it. A corrupt `localStorage` value must never produce a negative dash length, which SVG renders as nothing.

### Shared component: `mobile_bar.svelte`

The mobile bottom bar is **one component used by both pages**. Do not fork a second copy; extend its props.

- Props: `percent`, `primary`, `secondary`, `status`, `statusTone`, `syncing`, `onsync`, `searchPlaceholder`, `bind:query`, `onsearch`, and an optional `panel` snippet
- Internally owns one `mode: 'none' | 'search' | 'filter'` — **search and filter are mutually exclusive**, so the bar only ever grows by one row
- The filter button is hidden when no `panel` snippet is passed
- The panel expands via the `.expand-panel` `grid-template-rows` technique in `app.css` (no DOM add/remove)

### The library card: the link is an `::after`, not the card

The card is a `<div class="relative overflow-hidden rounded-lg">` holding the `<a>` and the add/remove `<button>` as **siblings**. A `<button>` nested inside an `<a>` is invalid HTML and its clicks activate the link instead of the button.

```
<div class="relative overflow-hidden rounded-lg">   ← the visual card (full-bleed art + scrims)
  <a class="after:absolute after:inset-0">…</a>      ← stretched full-card tap target
  <button class="absolute right-2 top-2 z-10">…</button>
</div>
```

The `<a>` gets `after:absolute after:inset-0` so the whole card stays tappable; the button needs `z-10` to win over that overlay. Do not "simplify" this back into `<a><button>`.

The button is an **absolute overlay on the artwork's top-right corner at every breakpoint**. An earlier revision put it in the right rail on mobile, standing in for the chevron — but the card is full-bleed and no longer has a chevron or a mobile/desktop split, so one overlay covers both.

### Card artwork: `object-cover` in a fixed 16:9 box

This **inverted** an earlier rule and the reason is worth keeping, because the old reasoning still looks persuasive.

Steam header images are 460×215 and bake the game's logo into the artwork, so `object-cover` used to be forbidden — cropping took the readable half of the logo with it. The card has since been rebuilt around a **text title directly beneath the image**, and the image is now cropped into a fixed `aspect-video` box. With the name rendered as text, losing the logo from the art costs nothing, and the letterbox bars that `object-contain` forced are gone entirely.

```
<div class="relative aspect-video bg-steam-light">
  <img class="h-full w-full object-cover" />
```

Two consequences:

- **The `from-35%` gradient and the `bg-steam-dark` wrapper fill are obsolete.** They existed only to hide the letterbox seam. With no bars there is no seam; the card now uses `bg-steam-blue` + a single flat `bg-steam-dark/25` scrim. Do not restore the two-scrim gradient "for safety" — there is nothing left for it to hide.
- **The fixed aspect ratio is what makes the card's height predictable**, so the skeleton (`aspect-[16/10]`, `rounded-xl`) must stay close in proportion or the grid jumps when the hydration gate opens.

### The bar is the card, not a ring in it

The card was once dominated by a 112px ring. It is now dominated by a linear bar:

```
[ ★ 91 ]  [ artwork 16:9            ]  [ + ]
          Elden Ring
          ▓▓▓▓▓▓░░░░░░  18/42
          43% complete
```

- **Linear beats a ring at card density.** At four-plus cards per row the eye compares bar *lengths* far faster than ring arcs, so the ranking is readable at a glance. Rings survive only where a single number deserves ceremony — the library total and the game-page header.
- **The ring also cost 40% of the card's height**, which is what broke the artwork seam above. Two bugs, one fix.
- **`shortDescription` is not rendered.** It is still in the `+page.server.ts` payload (the navbar and the game page use `steam`), so finding it in the HTML is not a bug — finding it in the *markup* is.
- **Metacritic sits on the artwork** at `absolute left-2 top-2` with a dark scrim; it is not worth a row of vertical space next to a bar.
- **The grid is `grid-cols-2 sm:3 lg:4 xl:5 2xl:6`.** The card lost its ring and is now dominated by a 16:9 image plus two short lines, so the minimum readable width dropped to ~170px and a laptop fits roughly twice as many games above the fold as before.

`toggleMode` is `'add' | 'added' | 'remove'`, not a boolean: in **My Library** every card is already selected, so a check icon would read as "all done". It shows a **minus** there ("take this back out") and a **check** in **All Games** for games already added.

### The toggle is a hit area around a chip, not a 40px button

The library toggle is a 40×40 `<button>` with **no visual of its own**; the 28×28 chip inside carries every bit of styling. They used to be the same element, which painted a 40px solid square at `-right-1 -top-1` that the card's `overflow-hidden` then sliced into an L-shape over the corner.

Keep the visual on the inner chip. If you raise or lower the tap target, change the button's box only.

### Artwork has a placeholder painted underneath it

`game_card.svelte` and the game-page hero each render four stacked `absolute` layers with `z-index: auto`, so tree order decides: **placeholder → image → scrim → badges**.

- The placeholder is always in the DOM, so a `loading="lazy"` image that has not started shows it instead of a blank slot.
- **Aniimo (4126040) and WARDOGS (1867240) have no Steam header, and no hero either.** `onerror` hides the `<img>` and the placeholder takes over. That is a permanent state, not an error.
- **There is no CDN retry.** Artwork is local (`/images/games/{appId}/`, see [platworks-steam.agent.md](./platworks-steam.agent.md) §1), so a failure means the game has no art — retrying a remote URL would only re-add the external dependency.

### Difficulty is never hue-only

`difficulty_pips.svelte` renders 1–4 filled pips **plus** the level's name. The old rows printed the word in a colour and nothing else, which is unreadable for colour-blind players and survives a screenshot as an anonymous coloured word. The pip count carries the level; the label still names it. Do not replace this with a colour-swatch badge.

`missable` is the **only** achievement tag that earns an alarm colour. `multiplayer`, `cumulative` and `secret` are neutral, so a row carrying several tags does not become a wall of colour.

### Totals are stat tiles, not a grey text line

The library page's headline used to be `"12 games · 847/1994 · 42%"` in small muted grey — technically the app's whole value proposition rendered as its least prominent element. It is now four `stat_tile.svelte` instances, with overall completion leading in the accent colour.

The tiles live in a **grid that always renders**, wrapping any `{#if}`. A tile that appears when its data becomes available pushes the grid down mid-gesture — the same failure as the scope switcher below.

### Two-pane on desktop, stacked with a gap on mobile

The page container is **only a grid at `lg`**. Below that the `<aside>` and the `<section>` are plain block siblings, so the aside's own `gap-3` cannot separate them — anything spanning the boundary needs its own margin. The filters wrapper is `mt-4 lg:mt-0`: the `mt-4` is the stacked-column gap on a phone, and the `lg:mt-0` zeroes it because at `lg` the columns sit side by side and a top margin would push the toolbar out of alignment with the top of the sidebar.

Dropping that `mt-4` during a refactor made the toolbar sit flush against the stats panel on every phone. **The gap belongs on the element that crosses the column boundary, not on either column's last child.**

`lg:grid-cols-[288px_minmax(0,1fr)]`. The old page capped the whole thing at `max-w-4xl`, which is a narrow ribbon on a 1440px display.

- **The sidebar is `lg:sticky lg:top-[4.5rem]` only.** Below `lg` it is the first block in flow; a sticky tall hero would pin to the top of the scroll and leave no room for the list.
- **The left column is, in order: artwork → name + description → chips → trophy information → actions.** The progress panel used to be the first block of the *right* column, which put "which game is this" and "how far through am I" in opposite columns with the whole list between them.
- **The artwork carries no text, and that is not a style choice.** The name and description sit below it in normal flow. An absolutely positioned block inside a fixed-ratio box cannot grow: a Steam blurb longer than the box escapes it, overlaps the artwork and spills out of the 288px sidebar. Measured before the fix — text escaped the sidebar at 1024, 1440 and 1920. The description is `line-clamp-3` at every width; Steam's longer blurbs run 300+ characters and the sidebar is 288px.
- **The hero is `aspect-[21/9]` below `lg`, `lg:aspect-video` above.** The old `min-h-56` banner plus a full stats panel plus two stacked buttons pushed the first achievement roughly **900px** down on a phone.
- **Type and Sort must stay reachable on a phone.** They were once `hidden sm:block`, leaving mobile with only All/Locked/Done. The filter row scrolls horizontally (`.scrollbar-none`) rather than wrapping, so it never pushes the list down.
- **There is no `<select>` for the achievement type.** The chip row does that job directly beneath it, with counts and a `missable` icon. The select was the same filter one control apart, and the chips were always the better presentation — "All types" is simply the state where no chip is pressed, and each chip toggles itself off on a second tap. Sort is the only `<select>` left.
- **The chip row renders whenever `types.length > 0`, not `> 1`.** Gating it on "more than one" made the toolbar gain or lose a row depending on the game, which is the same instability as the scope switcher appearing late.
- **Keep the guide prose inside a readable measure.** The sidebar is a fixed 288px precisely so the list column does not become a 1100px-wide line of text as an expanded row grows.

### The trophy card: the icon *is* the checkbox

### Library scope: nothing above the grid may appear or disappear

Adding a game to **My Library** happens by tapping `+` on a card that is already on screen. Any control that then **inserts itself above the grid moves the card the user just pressed, out from under their finger** — it also threw a "browse the whole catalogue" panel in below the grid, which nobody scrolls to. Both were here and both are gone.

Three rules now hold the page still:

- **The scope switcher is unconditional.** `My Library (0)` / `All Games (29)` render on the very first paint; the only thing that changes on the first add is the count, `0 → 1`. A tab that exists from the start can only change state — a tab that appears late re-lays-out the page.
- **`scope` is authoritative — never coerce it.** Do **not** reintroduce an `effectiveScope` that rewrites `'mine'` to `'all'` when the library is empty: with the switcher always visible that would make the tab a silent no-op when clicked. `'mine'` with nothing in it is a real state with a real empty view ("Your library is empty" + a **Browse all games** CTA).
- **The first-run hint lives in a fixed `h-5` slot directly under the switcher.** One line tall whether or not it has text, so showing and hiding it costs nothing. It carries `aria-live="polite"`, because after a `+` tap that is the only place the selection change is announced.

The reserved 20px is deliberate and is the price of the stability. Do not reclaim it.

### The trophy card: the icon *is* the checkbox

`achievement_row.svelte` has two sibling buttons, and the left one wraps the trophy image with the check indicator overlaid on its bottom-right corner.

```
[ trophy 64px ] [ name · badges · description          ⌄ ]
      └ check badge
```

Two reasons, do not "simplify" either:

- **The art is rendered at its native 64px.** Steam's achievement JPEGs are exactly 64×64 (verified from the SOF marker). Going past `h-16` upscales and softens on a 2x/3x screen, so 64px is the ceiling, not a round number.
- **Folding the check onto the art removes a ~40px checkbox column.** On a 320px viewport that reclaimed width is what keeps achievement names on one line; the separate-column layout leaves ~120px for text and truncates everything.

The check tap target is therefore 64×64, comfortably over the 40px floor in §5.

### Type badges are a loop, and only `missable` is coloured

`achievement.types` is a **list** of non-exclusive tags, so the row renders one badge
per tag with `{#each achievement.types as tag (tag)}` — not a single badge. A trophy
that is both `secret` and `missable` shows two.

`typeStyles` gives `missable` the red alarm treatment and everything else the neutral
`steam-light`. That is deliberate: with multiple tags per row, colouring them all
turns a trophy into a wall of red, and `missable` is the one tag that changes what the
player should *do*. An untagged trophy (`types: []`) renders no badges at all — there
is no `standard` tag to check for.

### The game page hero: text overlaid on the banner

- **Two scrims, not one.** A flat `bg-steam-dark/45` plus a `bg-gradient-to-t` from `steam-dark`. Steam banners range from near-black to almost white, so the flat pass stops a bright one washing out the title and the gradient keeps the copy off the busiest band. Dropping either regresses some games.
- **A fixed `aspect-*`, not `min-h`.** It is `aspect-[21/9]` below `lg` and `lg:aspect-video` above — see §1 for why the old `min-h-56` hero buried the list on a phone. With a fixed ratio there is no `pt` floor to reason about.
- **The image is decorative.** `alt=""` because the game name is the `h1` right there; a non-empty alt makes a screen reader announce the title twice. It also carries `fetchpriority="high"` — it is the page's LCP.
- **The blurb clamps to two lines below `lg`** and is unclamped above. Long Steam copy must not push the list off the first screenful on a phone.

### Vertical rhythm: the gap belongs on the wrapper, not the last child

The game page's progress bar, sync button and filter row are all desktop-or-mobile
conditional, so putting the bottom margin on whichever element happens to be visible
last is what produces a gap on one breakpoint and none on the other. **Progress and sync
share one `mb-6` wrapper**; the filter row keeps its own `mb-6`. On mobile both the sync
row and the filter row are `hidden`, so that wrapper's margin is the only thing keeping
the progress bar off the achievement list — which is exactly why it cannot live on a child.

The same trap applies to control heights. **Set `h-10` on every control in a row, never
`py-2`.** Padding-derived heights drift the moment the font size changes, so a search
field, a segmented filter, two `<select>`s and a text count end up a few pixels off each
other. A fixed height makes them share one baseline *and* satisfies the tap-target floor
in §5 at the same time.

`tabular-nums` on the "N shown" count: it changes width as digits change, which makes the
row reflow on every filter change.

### Lucide ships no brand logos

`@lucide/svelte` has ~7,900 icons and **none** of them is GitHub — brand marks were dropped from the set. The one exception is `github_icon.svelte`, an inline path for the GitHub mark, kept local rather than pulling in an icon library for a single glyph. If you need another brand mark, follow that file's pattern instead of reaching for a generic lookalike (`FolderGit2`, `GitBranch`) that users do not read as the brand.

The repo URL lives in one constant, `REPO_URL` in `+layout.svelte`. Change it there and in the README badge together.

## 2. Progress indicators: one green for "complete"

Both shapes now live in components, and all of them turn the **same** green (`--pw-success`, exposed as `steam-green`) at 100% so a finished game looks finished wherever you see it:

| Where | Component | Shape | Incomplete | Complete |
|---|---|---|---|---|
| library cards, game header, stat tiles | `progress_bar.svelte` | **linear**, `scaleX` fill | `bg-steam-accent` | `bg-steam-green` |
| game header, mobile bar | `progress_ring.svelte` | donut, `r=15.5` in a 36-unit viewBox | `stroke-steam-accent` | `stroke-steam-green` |

**Rings are for the few numbers that deserve ceremony** — the library total and the game-page header. Bars are for everything else; see §1 for why the card lost its ring.

The ring is an `<svg viewBox="0 0 36 36">` rotated `-rotate-90`, a track circle and a `stroke-linecap="round"` arc driven by `stroke-dasharray`. **The circumference factor (0.974) is that of `r=15.5`** — it converts a percentage into a fraction of the 100-unit dash path. It is computed in `progress_ring.svelte`, not repeated per call site.

Two rules that are easy to undo by accident:

- **Never put `stroke` in the transition list** (§4). Only `stroke-dasharray` animates. The colour flips on every completion, and transitioning it would repaint the component.
- **Both components clamp `percent`.** A corrupt `localStorage` value must not produce a negative dash length or a negative `scaleX`, which render as nothing at all.

`--pw-success` is the reference green. Do not introduce a second shade, and do not reach for Tailwind's `green-400` — it does not follow the palette. **`--pw-accent` is for interactive things** (buttons, links, focus) and `--pw-success` is for progress; in Ember the two happen to be the same colour, but Amber, Cobalt and Cyberpunk split them deliberately.

All of them key off `percent === 100`, **not** `completed === total`. `Math.round` means 999/1000 already displays "100%", and a bar that reads 100% must not still be accent-coloured.

## 3. Styling

- Tailwind CSS 4, **CSS-first** `@theme` in `src/app.css` — there is no `tailwind.config.js`.
- **Six palettes, one set of token names.** `app.css` declares `steam-dark/blue/light/accent/green` as `@theme inline` `var(--pw-*)` references, and each palette is a `[data-theme]` block overriding those vars. Swapping palette is one attribute on `<html>` — do **not** rename a token or you touch every component. Adding a palette = one CSS block + one entry in `THEMES` + one entry in the `app.html` validator list (see [platworks-state.agent.md](./platworks-state.agent.md) §6).
- Use the semantic tokens `--color-ink` / `ink-dim` / `ink-faint` / `line` for new markup rather than Tailwind's gray ramp, so text re-themes with the palette. Existing `text-gray-400` usages still work but do not follow the accent themes.
- Dark-first: `bg-gray-900 text-gray-100` as the base; `dark:` only to override.
- Group classes: layout → spacing → sizing → colors → typography → effects.
- No inline styles when a Tailwind utility exists.
- **Contrast:** all six palettes are verified against WCAG AA — body text ≥ 4.5:1, dim text ≥ 4.5:1, faint/decorative ≥ 3:1, accent-on-background ≥ 3:1, and accent-ink-on-accent ≥ 4.5:1. Re-check when editing a palette, since `--pw-accent-ink` exists precisely so text on an accent button stays legible on the lighter palettes.

## 4. Animation

- View Transitions for page navigation **only** — never for in-page state.
- Expand/collapse via CSS `grid-template-rows` (`.expand-panel`); never DOM add/remove.
- **Never put `stroke` in an SVG's transition list.** The mobile bar's ring re-renders on every checkbox tap, so animating its colour repaints the whole bar; transition `stroke-dasharray` only.
- **`prefers-reduced-motion` is honoured** by one `!important` block at the end of `app.css`. It drops every `animation-duration` and `transition-duration` to `0.01ms` rather than disabling animation, so state transitions still happen — the panel still opens, the bar still turns green. Disabling animations outright leaves controls looking broken.
- That block is last in the file and `!important` on purpose: a `duration-500` utility would otherwise win on specificity.
- Counts use `tabular-nums` (the `.tabular` utility) so digits do not shuffle sideways while animating.

## 5. Performance

- Animate only `transform` and `opacity` — GPU-composited properties.
- `content-visibility: auto` on long list items (see `.achievement-item` in `app.css`).
- Remove `transition-colors` / `transition-all` from frequently toggled elements.
- `will-change: transform` + `backface-visibility: hidden` on `sticky-nav` and `fixed-bottom-bar`.
- **Tap targets:** `h-11` (44px) in the navbar, `h-10` (40px) elsewhere. Never `h-9` — that is a desktop size and it is why the navbar used to feel cramped. Desktop keeps `h-9` via `sm:` overrides.
- The navbar bar is `h-16 sm:h-14`. Bump both the bar and its children together, or the 44px controls will not fit inside it.

## 6. Verifying a UI change

**Use Playwright — it works here now.** The setup and the absolute-path import for it are in [platworks-dev.agent.md](./platworks-dev.agent.md) §7.

At minimum, for any layout change, load every route at **390 / 768 / 1440** and assert:

1. `documentElement.scrollWidth === documentElement.clientWidth` (no horizontal overflow)
2. **Every control appears exactly once** — count visible `[role=radiogroup]`, `select`, and `input[type=text]`. This is the check that catches the duplicated-filter class of bug, which `curl` and `svelte-check` both miss completely.
3. **No interactive element under 40px tall.** See the `h-9` = 36px trap in §1.
4. No `pageerror` and no console errors.

Also screenshot each combo and actually look at it. Two of the bugs fixed in the last pass — a map link rendered twice on tablet, and a filter row whose search field sat off-screen — were obvious in a screenshot and invisible to every other check.