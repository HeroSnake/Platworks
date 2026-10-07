---
description: "Use for any visual or component change in PlatWorks: Svelte components, Tailwind styling, layout, mobile bar, trophy card, progress bars, animations, performance, icons, and app.css."
tools: [read, edit, search, execute]
---

# PlatWorks — UI layer

**You own:** `#lib/components/*.svelte`, `src/app.css`, all Tailwind markup, the shared layout, animations
and performance budgets.

**Always paired with:** [AGENTS.md](../AGENTS.md). Pair with
[sveltekit.md](./sveltekit.md) when the change involves navigation or
hydration, and with [state.md](./state.md) when a control reads or writes
persisted state.

**New UI work starts at `/ui-project`**, which scopes the change and produces HTML mockups in
`.tmp/ui/{slug}/` for approval *before* any code is written. Everything below is what those mockups are
drawn against.

---

## 1. Components

| Component | Role |
|---|---|
| `progress_bar.svelte` | **the default progress indicator** — linear, `scaleX` fill, optional `label`. Used on cards, the game header and the library tiles |
| `progress_ring.svelte` | ring, reserved for the few numbers that deserve ceremony (library total, game header). Never on a card |
| `stat_tile.svelte` | a headline figure with a label. The library page's totals |
| `segmented_control.svelte` | single-choice radio group; scrollable rather than wrapping. Used for scope, sort and the completion filter |
| `search_field.svelte` | the app's only search input. Both pages and the mobile bar use it |
| `action_button.svelte` | primary/secondary button with `loading`. Sync lives here |
| `difficulty_pips.svelte` | 1–4 filled pips + label. Difficulty must never be hue-only |
| `game_filters.svelte` | the game page's **entire** filter row, rendered once at every breakpoint |
| `theme_picker.svelte` | six-palette radiogroup: 3×2 grid of tiles, each a miniature of the palette. Inside the account popover |
| `achievement_row.svelte` | expandable trophy row: trophy image + check indicator overlaid, badges, pips |
| `game_card.svelte` | compact card: 16:9 artwork, title, linear bar, count. No ring |
| `github_icon.svelte` | inline GitHub mark |
| `mobile_bar.svelte` | shared bottom bar for **both** pages |
| `src/routes/+layout.svelte` | navbar, account popover, View Transitions, **the background pattern layer**; owns `REPO_URL` and `platworks:steamId` |

### Render a filter ONCE, not once per breakpoint

`game_filters.svelte` holds the whole filter row and is rendered **once, unconditionally**, at every
width. `overflow-x-auto` keeps it one row and makes the extras reachable by swiping. A wrapping filter
row would push the list down by a row's height every time an option is added.

Four rules follow:

- **Do not add a `panel` snippet to either page's `mobile_bar`.** Neither page passes one, so the bar
  carries progress, search and sync only and its filter button hides itself. Sort and the game filters
  both live in the page at every breakpoint — one control surface per page, not one per breakpoint.
- **The library toolbar is ONE row: scope → search → sort → sync.** `segmented_control.svelte` carries
  `w-fit shrink-0` so it shrink-wraps in a flex parent; `display: flex` in a block parent fills the width.
- **Never hide a control at one breakpoint and re-render it at another.** If it must exist in two places,
  it is one component with a `hidden` class, or one component rendered once.
- **Search is the one control allowed to differ per breakpoint** (`hidden sm:block` in both the library
  toolbar and `game_filters.svelte`), because the mobile bar owns it on a phone. One search box per
  breakpoint, never both.

### Tap targets: `h-9` is 36px and always fails

The 40px floor is the hard rule. `h-9` = 2.25rem = **36px** — it is a desktop size, and it is why the navbar
feels cramped when it is used. Use `h-10` (40px) everywhere else and `h-11` (44px) in the navbar.

| Control | Height |
|---|---|
| `game_card.svelte` library toggle | `h-10 w-10` hit area, 28px visual chip inside via a negative inset |
| `segmented_control.svelte` | `h-10` (both sizes) |
| `game_filters.svelte` selects + chips | `h-10` |
| navbar back / GitHub / account | 44px / 40px / 44px |
| `achievement_row.svelte` expand button | `min-h-10` box, but the real hit area is the whole header row via `after:inset-0` |
| `achievement_row.svelte` check toggle | the full left rail, full row height via `before:-inset-y-*` |

**A content-sized interactive element needs an explicit minimum.** The expand button sizes to its text,
so a trophy with an empty description left only the title line and fell under the floor.

The navbar bar is `h-16` (64px) at **every** breakpoint. Bump the bar and its children together, or the
44px controls will not fit inside it.

### Component rules

- **Do not hand-roll a control that already exists.** Two implementations of the same control drift, and
  these components exist to prevent exactly that.
- `progress_ring.svelte` and `progress_bar.svelte` both take `percent` and clamp it. A corrupt
  `localStorage` value must never produce a negative dash length, which SVG renders as nothing.

### `mobile_bar.svelte` is shared by both pages

One component, two call sites. Do not fork a second copy; extend its props.

- Props: `percent`, `primary`, `secondary`, `status`, `statusTone`, `syncing`, `onsync`,
  `searchPlaceholder`, `bind:query`, `onsearch`, and an optional `panel` snippet
- It owns one `mode: 'none' | 'search' | 'filter'` — **search and filter are mutually exclusive**, so the
  bar only ever grows by one row
- The filter button is hidden when no `panel` snippet is passed
- The panel expands via the `.expand-panel` `grid-template-rows` technique in `app.css` (no DOM add/remove)

### The library card: the link is an `::after`, not the card

The card is a `<div class="relative overflow-hidden rounded-lg">` holding the `<a>` and the add/remove
`<button>` as **siblings**. A `<button>` nested inside an `<a>` is invalid HTML and its clicks activate
the link instead.

```html
<div class="relative overflow-hidden rounded-lg">   <!-- the visual card: full-bleed art + scrims -->
  <a class="after:absolute after:inset-0">&hellip;</a>      <!-- stretched full-card tap target -->
  <button class="absolute right-2 top-2 z-10">&hellip;</button>
</div>
```

The `<a>` gets `after:absolute after:inset-0` so the whole card stays tappable; the button needs `z-10` to
win over that overlay.

The button is an **absolute overlay on the artwork's top-right corner at every breakpoint**. The card is
full-bleed with no mobile/desktop split, so one overlay covers both.

### Card artwork: `object-cover` in a fixed 16:9 box

Steam header images are 460&times;215 and bake the game's logo into the artwork. `object-cover` is safe
**because** the card renders the name as text directly beneath the image — cropping costs nothing when
the readable name is not part of the picture.

```html
<div class="relative aspect-video bg-steam-light">
  <img class="h-full w-full object-cover" />
```

Consequences to keep:

- the scrim over the image stops the artwork's own logo competing with the card's text
- the placeholder layer is always rendered *underneath* the `<img>` and takes over when the image is
  absent — so finding "No artwork" in a DOM query proves nothing about whether images loaded

### Totals are stat tiles

The library headline is four `stat_tile.svelte` instances, with overall completion leading in the accent
colour. They live in a **grid that always renders**, wrapping any `{#if}`. A tile that appears when its
data becomes available pushes the grid down mid-gesture.

### Two-pane on desktop, stacked with a gap on mobile

The game page container is **only a grid at `lg`**. Below that the `<aside>` and `<section>` are plain
block siblings, so the aside's own `gap-3` cannot separate them — anything spanning the boundary needs its
own margin. The filters wrapper is `mt-4 lg:mt-0`: the `mt-4` is the stacked-column gap on a phone, and
the `lg:mt-0` zeroes it because at `lg` the columns sit side by side and a top margin would push the
toolbar out of alignment with the top of the sidebar.

`lg:grid-cols-[288px_minmax(0,1fr)]`.

- **The sidebar is `lg:sticky lg:top-[4.5rem]` only.** Below `lg` it is the first block in flow; a sticky
  tall hero would pin to the top of the scroll and leave no room for the list.
- **The left column is, in order: artwork &rarr; name + description &rarr; chips &rarr; trophy information
  &rarr; actions.**
- **The artwork carries no text.** The name and description sit below it in normal flow. An absolutely
  positioned block inside a fixed-ratio box cannot grow: a Steam blurb longer than the box escapes it,
  overlaps the artwork and spills out of the 288px sidebar. The description is `line-clamp-3` at every
  width; Steam's longer blurbs run 300+ characters.
- **The hero is `aspect-[21/9]` below `lg`, `lg:aspect-video` above.** A `min-h-*` hero plus a full stats
  panel plus two stacked buttons pushes the first achievement ~900px down on a phone.
- **Type and Sort must stay reachable on a phone.** The filter row scrolls horizontally
  (`.scrollbar-none`) rather than wrapping, so it never pushes the list down.
- **There is no `<select>` for the achievement type.** The chip row does that job beneath it, with counts
  and a `missable` icon — the same filter one control apart, and always the better presentation. Sort is
  the only `<select>`.
- **The chip row renders whenever `types.length > 0`, not `> 1`.** Gating it on "more than one" makes the
  toolbar gain or lose a row depending on the game.
- **Keep the guide prose inside a readable measure.** The sidebar is a fixed 288px precisely so the list
  column does not become a 1100px-wide line of text as a row grows.

### The theme picker: a grid of palette miniatures, not a row of swatches

`theme_picker.svelte` renders six tiles in `grid-cols-3`. Each tile is a miniature of its palette —
page background, a raised surface card, an accent bar and a completion bar — not a single colour chip.

- **A grid, never `flex-wrap`.** Six items in a wrapping row produce rows of 3/2/1, so the block is only as
  wide as its widest row and the selection jumps sideways whenever the popover re-lays out. A fixed grid is
  stable at every width and still reads as two tidy rows down to a 320px screen.
- **Both bars sit inside the card, below its top edge.** The check badge is absolutely positioned at the
  *tile's* top-right, so anything at that corner merges with it — the preview dot and the check were drawn
  on top of each other and read as one blob.
- **Preview colours are literals in `theme.ts`, not `var(--pw-accent)`.** The picker has to show palettes
  that are *not* currently applied, and a CSS variable resolves against whatever is on screen — all six
  tiles would render identically. That means `swatch` / `bg` / `success` are duplicated from `app.css`, so
  **a palette edit must be copied into `THEMES`** or the tile lies about what it selects.
- **Roving tabindex + arrow keys.** Only the checked tile has `tabindex="0"`; Arrow/Home/End move focus *and*
  select, which is what makes it a radiogroup rather than six buttons. Left/Right wrap because there is no
  tabbable element outside the group to escape to.
- `aria-checked`, not a class alone, is the selection signal. The check badge is `aria-hidden`.

### The trophy card: the icon *is* the checkbox

`achievement_row.svelte` has two sibling buttons; the left one wraps the trophy image with the check
indicator overlaid on its bottom-right corner.

```
[ trophy 64px ] [ name - badges - description          v ]
      +- check badge
```

Two rules, do not "simplify" either:

- **The art is rendered at its native 64px.** Steam achievement JPEGs are exactly 64&times;64 (verified
  from the SOF marker). Going past `h-16` upscales and softens on a 2x/3x screen, so 64px is the
  ceiling, not a round number.
- **Folding the check onto the art removes a ~40px checkbox column.** On a 320px viewport that reclaimed
  width is what keeps achievement names on one line; the separate-column layout leaves ~120px for text
  and truncates everything.

#### A collapsed card is 90px. Never put a negative vertical margin in that row

90px = the 64px trophy + 2&times;12px (`sm:p-3`) + the 1px borders; 82px at `sm:`-less widths, where
the padding is `p-2`. `contain-intrinsic-size: auto 90px` in `app.css` tracks this number and must move
with it.

The trap: a flex item's **negative vertical margin shrinks the flex line's cross size**, and that line is
what sizes the row. So `-my-2 sm:-my-3` on the toggle button — added to bleed its hit area into the row's
padding — silently took 24px out of the card. The 64px icon then overflowed a 65px row and sat flush
against both card borders, and the check badge rode the bottom border. Nothing errors; the card just
comes out 23px too short. **`-ml-*` on that button is fine** (main axis, no effect on height) — only the
vertical axis is dangerous.

Bleed vertically with an absolutely positioned pseudo-element instead. The button carries
`before:absolute before:-inset-y-2 before:left-0 before:right-0` (`sm:before:-inset-y-3`, tracking the
padding). It is bounded by the row, so it never reaches into the expanded panel and needs no breakpoint
guard.

#### The whole header row is the expand target, not the text button

The expand button gets `after:absolute after:inset-0`. `inset-0` resolves against the **row** (`relative`),
not against the button, so the card's own padding is no longer a dead zone — tapping 4px inside any card
border expands it. It stops at the row, so the open guide keeps its own links.

The toggle rail therefore carries `z-10` to win that overlay in the left strip. **Strip and text are the
only two hit zones in the header row**; anything added between them needs a `z-index` or it will be
untappable. If you see a `NO-OP` in a click audit at 768px or 390px, check the probe is inside the
viewport first — a card below the fold reports `elementFromPoint` misses that look exactly like dead
controls.

### Type badges are a loop, and only `missable` is coloured

`achievement.types` is a **list** of non-exclusive tags, so the row renders one badge per tag — not a
single badge. A trophy that is both `secret` and `missable` shows two.

`typeStyles` gives `missable` the red alarm treatment and everything else the neutral `steam-light`. With
multiple tags per row, colouring them all turns a trophy into a wall of red, and `missable` is the one
tag that changes what the player should *do*. An untagged trophy (`types: []`) renders no badges: an
empty array **is** the plain trophy, and a `standard` tag would permit contradictions like
`["standard","secret"]`.

### The game page hero: text overlaid on the banner

- **Two scrims, not one.** A flat `bg-steam-dark/45` plus a `bg-gradient-to-t` from `steam-dark`. Steam
  banners range from near-black to almost white, so the flat pass stops a bright one washing out the
  title and the gradient keeps the copy off the busiest band. Dropping either regresses some games.
- **A fixed `aspect-*`, not `min-h`.**
- **The image is decorative.** `alt=""` because the game name is the `h1` right there. It carries
  `fetchpriority="high"` — it is the page's LCP.
- **The blurb clamps to two lines below `lg`** and is unclamped above.

### Library scope: nothing above the grid may appear or disappear

Adding a game to **My Library** happens by tapping `+` on a card that is already on screen. Any control
that then **inserts itself above the grid moves the card the user just pressed, out from under their
finger**. Three rules hold the page still:

- **The scope switcher is unconditional.** `My Library (0)` / `All Games (29)` render on the very first
  paint; the only thing that changes on the first add is the count, `0 &rarr; 1`. A control that exists
  from the start can only change state.
- **`scope` is authoritative — never coerce it.** There is deliberately no `effectiveScope`. Reintroducing
  one that rewrites `'mine'` to `'all'` when the library is empty makes the tab a silent no-op when
  clicked. `'mine'` with nothing in it is a real state with a real empty view ("Your library is empty" +
  a **Browse all games** CTA).
- **The first-run hint lives in a fixed `h-5` slot directly under the switcher.** One line tall whether
  or not it has text, so showing and hiding it costs nothing. It carries `aria-live="polite"`.

The reserved 20px is deliberate and is the price of the stability. Do not reclaim it.

### Vertical rhythm: the gap belongs on the wrapper, not the last child

The game page's progress bar, sync button and filter row are all desktop-or-mobile-conditional, so putting
the bottom margin on whichever element happens to be visible last produces a gap on one breakpoint and
none on the other. **Progress and sync share one `mb-6` wrapper**; the filter row keeps its own `mb-6`.

The same trap applies to control heights. **Set `h-10` on every control in a row, never `py-2`.**
Padding-derived heights drift the moment the font size changes. `tabular-nums` on the "N shown" count: it
changes width as digits change, which makes the row reflow on every filter change.

### Lucide ships no brand logos

`@lucide/svelte` has ~7,900 icons and **none** of them is GitHub — brand marks were dropped from the set.
The one exception is `github_icon.svelte`, an inline path for the GitHub mark. If you need another brand
mark, follow that file's pattern instead of reaching for a generic lookalike (`FolderGit2`, `GitBranch`)
that users do not read as the brand.

The repo URL lives in one constant, `REPO_URL` in `+layout.svelte`. Change it there and in the README
badge together.

## 2. Progress indicators: one green for "complete"

Every shape turns the **same** green (`--pw-success`, exposed as `steam-green`) at 100%:

| Where | Component | Shape | Incomplete | Complete |
|---|---|---|---|---|
| library cards, game header, stat tiles | `progress_bar.svelte` | **linear**, `scaleX` fill | `bg-steam-accent` | `bg-steam-green` |
| game header, mobile bar | `progress_ring.svelte` | donut, `r=15.5` in a 36-unit viewBox | `stroke-steam-accent` | `stroke-steam-green` |

**Rings are for the few numbers that deserve ceremony** — the library total and the game-page header. Bars
are for everything else.

The ring is an `<svg viewBox="0 0 36 36">` rotated `-rotate-90`, a track circle and a
`stroke-linecap="round"` arc driven by `stroke-dasharray`. **The circumference factor (0.974) is that of
`r=15.5`** — it converts a percentage into a fraction of the 100-unit dash path. It is computed in
`progress_ring.svelte`, not repeated at call sites.

Three rules that are easy to undo by accident:

- **Never put `stroke` in the transition list.** Only `stroke-dasharray` animates. The colour flips on
  every completion, and transitioning it would repaint the component.
- **Both components clamp `percent`.** A corrupt `localStorage` value must not produce a negative dash
  length or `scaleX`, which render as nothing at all.
- **They key off `percent === 100`, not `completed === total`.** `Math.round` means 999/1000 already
  displays "100%", and a bar that reads 100% must not still be accent-coloured.

`--pw-success` is the reference green. Do not introduce a second shade, and do not reach for Tailwind's
`green-400` — it does not follow the palette. **`--pw-accent` is for interactive things** (buttons,
links, focus) and `--pw-success` is for progress; in Ember the two are the same colour, but Amber, Cobalt
and Cyberpunk split them deliberately.

## 3. Styling

- Tailwind CSS 4, **CSS-first** `@theme` in `src/app.css` — there is no `tailwind.config.js`.
- **Six palettes, one set of token names.** `app.css` declares `steam-dark/blue/light/accent/green` and
  `ink/ink-dim/ink-faint/line/accent-ink` as `@theme inline` `var(--pw-*)` references, and each palette is a
  `[data-theme]` block overriding those vars. Swapping palette is one attribute on `<html>` — do **not** rename a
  token. Adding a palette has four registration points; see [state.md](./state.md) §6.
- Use the semantic tokens `--color-ink` / `ink-dim` / `ink-faint` / `line` for new markup rather than
  Tailwind's `gray-*` ramp, so text re-themes with the palette.
- Dark-first. Group classes: layout → spacing → sizing → colors → typography → effects.
- No inline styles when a Tailwind utility exists.
- **Contrast:** all six palettes are verified against WCAG AA — body text ≥ 4.5:1, dim text ≥ 4.5:1,
  faint/decorative ≥ 3:1, accent-on-background ≥ 3:1, accent-ink-on-accent ≥ 4.5:1. Re-check when editing
  a palette, since `--pw-accent-ink` exists precisely so text on an accent button stays legible on the
  lighter palettes.

### Text on an accent fill is `text-accent-ink`, never `text-steam-dark`

`--pw-accent-ink` is the only ink allowed on a `bg-steam-accent` surface. The obvious-looking alternative,
`text-steam-dark`, is the **page background** — an unrelated token that happens to be dark in all six
palettes. It looks correct until a palette has a pale primary (Amber's `#ffd27d`), where black is the only
legible choice and `text-steam-dark` still happens to pass. The coupling that breaks is the reverse one: it
silently ties every accent button to the background ramp, so the two can never be reworked independently.

`--pw-accent-ink` used to exist with no consumer at all, which is how this survived. A token that nothing
reads is not evidence that the token is unnecessary — check for the *class* before assuming.

### A palette is a hue-cast ramp, not an accent swap

Two themes that differ only in `--pw-accent` read as **the same app with a different button**. What makes a
palette legible as its own thing is that `--pw-bg`, `--pw-surface`, `--pw-surface-2` and `--pw-border` are
all tinted toward the same hue as the primary. Ember and Amber are the test case: both are "orange on dark",
and only the caramel ramp on Amber tells them apart before you read the label.

The rules a `[data-theme]` block has to satisfy:

| Rule | Why |
|---|---|
| every token declared, all eleven | a missing one silently inherits the previous palette's value |
| the ramp carries the primary's hue | an accent-only change is not a new theme |
| ≥ 15° from **every** other palette's `--pw-accent` | two palettes one step apart are indistinguishable side by side in the picker |
| ≥ 3:1 for `--pw-accent` and `--pw-success` on both `--pw-bg` and `--pw-surface` | both appear as small marks and thin bars, not only as large text |
| `--pw-accent-ink` ≥ 4.5:1 on `--pw-accent` | it is the label on every accent button |
| the display face, if overridden, is in the `app.html` font link | a missing family falls back silently — no error, just Space Grotesk |

**`npm run check` does not test colour.** It cannot see a contrast failure, and it cannot see two palettes
that have drifted onto the same hue. After editing a palette, re-run the contrast audit by hand and confirm
in the browser — the picker shows all six previews at once, which is the fastest way to spot two that have
become indistinguishable.

### The display face is a palette choice

Matrix is JetBrains Mono and Cyberpunk is Orbitron; the other four are Space Grotesk. This does more work
than any colour tweak — a palette is recognised by its type before its colour is read. Only the display
face moves (`--pw-font-display`); body text stays Inter everywhere.

`--pw-font-display` defaults on the bare `:root` rule and is overridden in the same
`:root[data-theme=…]` block as the palette's colours, so **a palette's tokens live in two blocks that are
adjacent but not merged**. That is deliberate: the font override is grouped with the themes that override it,
whereas four of the six inherit the default.

### The background pattern: a fixed tile, and two traps that hide it

A tilted 135px lattice behind the whole app — 45° dashes in the palette's accent, the app's own lucide
`Trophy` rotated to the same 45° in `--pw-dim`. Three static layers, all in `app.css`:

| Layer | What it does |
|---|---|
| `.pw-pattern` | `position: fixed`, one SVG `<pattern>` tile, behind everything |
| `.pw-pattern::after` | a radial scrim that thins the tile toward the fold so the card grid wins |
| `.pw-quiet` | masks the tile **out** of each filter row, so it stops behind the controls |

**The tile is an inline SVG `<pattern>` in `+layout.svelte`, not a `background-image` data URI.** The
colours are CSS variables, so all six palettes follow `data-theme` with nothing to regenerate, and a paint
server referenced from SVG *markup* resolves in every browser. Safari does not reliably resolve
`background-image: url(#id)` pointing at a paint server, which is what would force a per-palette data URI
and six duplicated files.

Two ways to break it:

1. **A background on the layout wrapper.** It paints over a fixed layer behind it and the pattern
   disappears. The page background lives on `body`; the wrapper is `relative z-10 min-h-screen text-ink`
   and **transparent**.
2. **`z-index` on `.pw-quiet` itself.** A `z-index` other than `auto` makes the element a stacking
   context, which drops its **entire** subtree — the toolbar, the segmented buttons, the search input —
   below every other in-flow element of the page. The page wrapper's own box then wins the hit test and
   swallows every click, and it looks flawless in a screenshot. The band is painted by `.pw-quiet::before`
   with `pointer-events: none` instead: a pseudo-element can sit at `z-index: -1` without its parent
   becoming a stacking context, and it never enters the hit test.

Rule that follows: **a decorative overlay must be `pointer-events: none`, and it must be a pseudo-element
or a sibling — never the element whose children need to be clickable.**

Two more rules that follow from the design:

- **Nothing over the pattern may use `backdrop-filter`.** The nav, the account popover and the mobile bar
  are opaque `--pw-bg`. A blur over a tiled background smears it into a soft band, and it is the one
  expensive thing on the page.
- **Two inks per palette, `--pw-pattern-dash` and `--pw-pattern-trophy`.** The tile geometry is not
  per-palette and must never be copied into a `[data-theme]` block.

The tile drops to 96px below `sm` (`#pw-tile-sm`, a `patternTransform="scale(0.7111)"` of the same
geometry) because three columns on a 390 screen is too coarse next to a 5px progress bar. It is
`@media print { display: none }`.

## 4. Animation

- View Transitions for page navigation **only** — never for in-page state.
- Expand/collapse via CSS `grid-template-rows` (`.expand-panel`); never DOM add/remove.
- **Never put `stroke` in an SVG's transition list.**
- **`prefers-reduced-motion` is honoured** by one `!important` block at the end of `app.css`. It drops
  every `animation-duration` and `transition-duration` to `0.01ms` rather than disabling animation, so
  state transitions still happen. Disabling animations outright leaves controls looking broken. That
  block is last in the file and `!important` on purpose: a `duration-500` utility would otherwise win on
  specificity.
- Counts use `tabular-nums` (`.tabular`) so digits do not shuffle sideways while animating.

### The trophy row is the app's only celebration — tiers 2, 3 and 4

`achievement_row.svelte` carries four motions, all defined in `app.css`. Nothing else in the
app celebrates anything, and that is the point: unlocking a trophy is the emotional beat of a
completionist app, so it is the one place motion is spent.

| Tier | Class | What | Duration |
|---|---|---|---|
| press | `.pw-press` | squash to `0.955`, spring back past rest | `90ms` in, `420ms` out |
| celebrate | `.pw-celebrate` | the row leaps; a ring expands out of the icon; an `UNLOCKED` ribbon wipes across | `900ms` |
| relock | `.pw-relock` | the row contracts **inward** with a damped recoil; a ring **implodes**; the green drains out | `420ms` |
| exit | `.pw-exit` | the row collapses to nothing and fades — the active filter just dropped it | `280ms` |

Six rules, each of which exists because the obvious version was wrong:

- **The reverse is not the celebration played backwards.** Unlocking grows outward and
  overshoots; locking contracts inward and damps out. Same spring curve, opposite direction,
  and deliberately **shorter** (`420ms` vs `900ms`) — a thing you are *undoing* should not
  hold the screen as long as a thing you have just done.
- **Everything is on `.achievement-item`'s two pseudo-elements.** `::before` is the ring on both
  paths (expanding / imploding); `::after` is the ribbon on unlock and the draining green on
  lock. **No runtime DOM is added**, so no effect can intercept a click, disturb the expand
  button's `after:inset-0` target, or win the hit test against the toggle rail — the exact
  failure modes in §1. Both are `pointer-events: none` regardless, because the *row's* `::after`
  is not the same element as the expand button's own `after:inset-0`, and that distinction is
  easy to lose.
- **The ribbon is a shrink-wrapped pill, and its padding is the centring.** `inset: 0 auto 0 0`
  makes the box exactly `padding + label`, so the padding is the only thing between the text
  and the band's edge — `padding-left` alone (the bug) leaves `UNLOCKED` flush against the right
  side. It must stay **symmetric**. Do not "fix" the narrow width into a full-bleed `inset: 0`
  band without asking: the pill travelling across the card is the design, and widening it to the
  row is a visible change, not a bug fix. The `text-indent` is half the `letter-spacing`, because
  tracking adds a trailing space after the *last* glyph too and centring the advance box leaves
  the ink half a step left of centre.
  - **The ribbon needs `z-index: 20`, above the toggle rail's `z-10`.** Not decoration: the rail
    wins the paint order by default, and the 64px trophy plus its check badge sit exactly where
    the label is, so at `z-index: auto` the ribbon painted *underneath* them and `UNLOCKED` was
    unreadable. The ring stays at `z-index: 1` on purpose — a ring growing from **behind** the
    icon reads as emitting from it, while the ribbon has to be in front. Remember that
    `.achievement-item` is its own stacking context (`content-visibility: auto` implies paint
    containment), so these values are compared inside the card, not against the page.
- **The ring is anchored to the icon, not the row.** The toggle's `-ml-*` cancels the row's
  `p-*`, so the `h-16 w-16` trophy sits flush with the card's left border at every breakpoint:
  `left: 0` on a `64px` box puts the box centre exactly on the icon's centre, and `scale()`
  grows from there.
- **A second tap on the same trophy needs `tick()`.** `motion` is cleared, `await tick()`, then
  re-set — Svelte batches state within a tick, so assigning the same value twice never reaches
  the DOM and the animation silently does not replay. The clear timers are `20ms` longer than
  the CSS so the class outlives the animation. `handleToggle` reads `achieved` **before**
  calling `ontoggle()`, or the original direction is already gone.

#### A row the filter drops must be HELD, or every tier above is invisible

Under a completion filter, toggling a trophy makes it stop matching — so the keyed `{#each}`
destroys the row **in the same flush that applies `pw-celebrate`**. The whole celebration was
painted on a node that no longer existed, and the player saw a trophy blink out of existence.
Nothing errors; every other check passes.

The row is therefore kept in the list until it reports back:

| Piece | Lives in | Job |
|---|---|---|
| `departing` | game page | `Set` of ids mid-exit. `toggleCheck` adds one when the row was listed before the flip and is not after |
| `candidates` / `passesCompletion` | game page | the search + tag filter split away from the completion filter, so a dropped row can be put back where it was |
| `visibleAchievements` | game page | `candidates` filtered by `passesCompletion(id) || held`, then sorted |
| `exiting` / `onvanished` | row props | the row plays its tier, then `advance()` checks `exiting` and plays `.pw-exit`, then calls back |
| `.pw-vanish-clip` | row markup | the single grid item the collapse closes, `overflow: hidden` + `min-height: 0` |

Six traps, all of which fail silently:

- **A toggle that CANCELS OUT must release the hold.** `toggleCheck` releases on the way back in,
  not only on the way out. Without the release, a second tap inside the celebration window leaves
  the id in `departing`, so `advance()` hands over to `.pw-exit` for a row that never left: the
  card collapses and fades, then springs back. It is *still in the DOM at the same index the whole
  time*, so `count` and `index` both pass — see the `visible` assertion in §6 for what catches it.
- **Re-filter `candidates`; never append the held rows.** `[...filtered, ...held]` is the obvious
  spelling and it is wrong: `sortList` is a **no-op under the default sort**, so the held row lands
  **last** and the card the player just tapped teleports to the bottom of the list. It looks like a
  rendering bug, not a data bug, and it is invisible in a screenshot of the top of the page.
- **`untrack` the guard in the "filters changed, release everything" effect.** That effect must
  depend on `filter` / `typeFilter` / `gameSort` / `trophyQuery` **only**. Reading `departing` in it
  makes the effect re-run the instant `depart()` fires, clearing the id in the same tick it was
  added — which restores the original bug exactly, and looks like the fix never landed.
- **Reassign the `Set`; never mutate it.** `$state` is only reactive on reassignment, so an
  in-place `.delete()` leaves the list rendering the old membership.
- **`exiting` cannot be read at toggle time**, and **a row must cancel an exit it no longer owes.**
  The page sets `exiting` as a *consequence* of `ontoggle()`, so it is read one animation later, in
  `advance()`. The mirror of that is an `$effect` that clears a running `.pw-exit` the moment
  `exiting` goes false — otherwise a row the page stops holding sits at zero height and zero
  opacity, still listed, until the exit timer happens to fire.
- **The collapse is `grid-template-rows`, and it must be in the keyframes.** Setting `0fr` as a
  plain declaration on `.pw-exit` snaps the row shut and leaves only the fade, which is the
  "it just disappeared" this tier exists to fix. `min-height: 0` on the clip is load-bearing: a
  grid item's automatic minimum size is its content size, so without it `0fr` cannot close. Do
  **not** reach for `max-height` — it is wrong at every breakpoint and for a row with its guide open.
- **The exit also cancels the list's `gap`, via `margin-block: -0.5rem`.** The list is `gap-2`,
  and gap is measured between margin boxes, so a card collapsed to zero height leaves **both** of
  its gaps behind: the rows below stop 16px short and then jump the rest of the way when the node
  is removed. One negative margin is not enough — it only cancels the gap below. This is **not**
  the forbidden negative margin in §1: that rule is about a negative *vertical* margin inside the
  row's horizontal `flex` line, where vertical is the **cross** axis and the margin shrinks the
  line's cross size. The achievement list is `flex-col`, where vertical is the **main** axis, so
  the margin only reduces this item's own outer size.

**Past ~920ms there is deliberately nothing to re-tap.** The celebration ends and `.pw-exit` sets
`pointer-events: none`, so a click landing on the collapsing card goes to the row underneath. That is
the right trade: the card is already invisible, and re-toggling a row that is leaving would fight
the exit it is in the middle of. Do not "fix" it by making the exit tappable.
- **The fade finishes early (55%) while the collapse keeps going.** The card is already
  invisible when the rows below start closing the gap, so nobody sees an empty box sliding shut.

`--motion-in` (accelerating) is correct for this tier and `--motion-settle` is not: the row is
*leaving*, and the acceleration is what makes it read as getting pulled away rather than
released.

`.pw-press` deliberately has **no `will-change`**: a 100-achievement page holds 100 of them,
and web.dev is explicit that `will-change` is for a measured problem. A transform transition is
promoted for its duration without it.

Motion is CSS animations, **not** `element.animate()`. That is not a style preference: the
`prefers-reduced-motion` block at the end of `app.css` works by collapsing `animation-duration`
to `0.01ms`, and **it does not apply to WAAPI animations.** Reduced-motion users would get the
full motion unless the media query were re-implemented in TypeScript, duplicating a rule that
already exists. Under the CSS block every effect lands on its final frame — `opacity: 0` — so
the effects vanish and the row still turns green, which is the correct degraded form rather than
a missing feature.

**Ink on the success fill** is `--pw-bg`. That is the one place in the app that uses a token for
something it was not designed for: `--pw-success` is light in all six palettes (green five
times, magenta in Cyberpunk) and `--pw-bg` is the darkest token in all six, so the pairing is
guaranteed legible. The principled version is a real `--pw-success-ink` across every palette
block — see §3 before changing either one, because adding a token has four registration points.

Easing lives in three tokens on `:root` (`--pw-motion-spring`, `--pw-motion-in`,
`--pw-motion-settle`) and durations live with the rules that use them. Only `--pw-motion-settle`
is sourced — it is the family of Material's verified standard curve `cubic-bezier(.4, 0, .2, 1)`.
The spring is the easings.net `easeOutBack` convention and is **chosen, not cited**; do not
present it as a spec value.

## 5. Performance

- Animate only `transform` and `opacity` — GPU-composited properties.
- `content-visibility: auto` on long list items (`.achievement-item` in `app.css`).
- Remove `transition-colors` / `transition-all` from frequently toggled elements.
- `will-change: transform` + `backface-visibility: hidden` on `sticky-nav` and `fixed-bottom-bar`.
- **The background pattern adds one composited layer, not one per layer of it.** The tile and its scrim
  share a layer because the scrim is a `::after`. All three background layers are static, so they paint
  once per route rather than per scroll frame. `content-visibility: auto` is unaffected by a `fixed`
  layer behind the list.

## 6. Verifying a UI change

**Run `node scripts/agent/ui-audit.mjs`. Do not write the audit yourself** — the rules below are
implemented in `scripts/agent/lib/ui-checks.mjs`, and that file is the executable copy of this section.
Change a rule here and you must change it there, or the next audit enforces the old one.

Setup and the Playwright install are in [AGENTS.md](../AGENTS.md) §7. The
script finds a dev server on `:5173` or `:4173` itself; it never starts one.

```bash
node scripts/agent/ui-audit.mjs                                  # / + one game route, 390/768/1440
node scripts/agent/ui-audit.mjs --routes /,/game/1245620
node scripts/agent/ui-audit.mjs --checks .tmp/ui/clicks.mjs      # + click checks
```

For any layout change it loads every route at **390 / 768 / 1440** and asserts:

1. `documentElement.scrollWidth === documentElement.clientWidth` (no horizontal overflow)
2. **Every control appears exactly once**
3. **No interactive element under 40px tall.**
4. No `pageerror` and no console errors.

### Two ways checks 2 and 3 get it wrong

**Do not count elements — group them by identity.** The library legitimately renders three
radiogroups (scope, sort, completion) and legitimately shows one search box per breakpoint. "Count the
`select`s" is therefore not a rule; *"the same labelled control must not appear twice"* is, and that is
what the script does. A raw count is how a duplicated filter row slips through a check that "passes".

**Do not read `getBoundingClientRect()` for the tap-target floor — hit-test it.** The rect is not the
hit area: `achievement_row.svelte` stretches its toggle with `after:inset-0` and bleeds its check rail
with `before:-inset-y-*`, so the real target is far taller than the element. A rect-based check fails
those deliberately-oversized controls. A pseudo-element hit-tests as its originating element, so the
script walks outward with `elementFromPoint` and measures the truth. Only elements whose own box is
already under 40px are measured, which is what keeps the audit fast on a page of trophy rows.

### And actually CLICK them — a geometry audit cannot see a dead control

A toolbar once shipped with every control unclickable and passed all four checks above, because a
stacking context had buried it below the page. Geometry checks answer *"is this element the right size
and in the right place?"*; they cannot answer *"does clicking it do anything?"*. Any change that adds
an overlay, a mask, a pseudo-element or a `z-index` needs this as well.

A click check is **declarative** — you name the control and what it must change, and the script
supplies the fresh page, the scroll-into-view and the probing:

```js
// .tmp/ui/clicks.mjs — start from scripts/agent/examples/clicks.mjs
export default [
  {
    name: 'Sort games — completion',
    route: '/',
    click: '[aria-label="Sort games"] [role=radio] >> nth=1',
    expect: { storage: ['platworks:sort'] }   // the value must change
  }
];
```

`expect` takes `storage` keys, an `attr` of `selector` / `name` / `equals`, an `htmlAttr`, or a `url`
substring. **A check with no `expect` fails on purpose** — asserting on "the click did not throw" is
not a test. Assert on an **observable state change** — `localStorage`, the URL, `aria-checked`,
`aria-pressed` — not on absence of an exception.

Give each check its own page: the script already does, because an earlier check that switches to an
empty tab makes the next one fail for the wrong reason, and you will debug the wrong thing.

**A filter is a list, so `count` is how you assert one.** `storage` proves the filter was *written*
and `attr` proves a control is *marked* — neither can say what the rendered rows actually did.
`count` reports how many elements match a selector, and it is exempt from the "everything else must
change" rule because its whole job is often to assert that something did **not** change:

```js
// The row must survive long enough to animate out of the filtered list.
expect: {
  count: { selector: '.achievement-item' },   // no `equals` == must be UNCHANGED
  storage: ['platworks:checked:1903340']      // while this one does change
}
```

**`count` is not enough on its own — an element can keep the count right and still move.** Appending
a held row to the end of a list instead of filtering it back into place leaves `count` perfectly
correct while moving the card the player just clicked to the bottom of the page. `index` is the
assertion for *where*: it reports an element's position among its siblings' matches, and likewise
defaults to "must be unchanged".

```js
expect: {
  index: { selector: '.achievement-item >> nth=2', within: '.achievement-item' },
  storage: ['platworks:checked:1903340']
}
// -> ".achievement-item >> nth=2 moved from position 2 to 54"
```

Give `count` an `equals` to assert a specific length, and `index` an `equals` for a specific
position.

**A before/after pair cannot see a TRANSIENT fault, and that is a whole class of bug.** A row that
collapses to nothing and springs back inside the window ends exactly where it started and passes
every `count`, `index`, `storage` and `attr` assertion on earth. `visible` is the only assertion
that polls:

```js
expect: { visible: { selector: '.achievement-item >> nth=2', minHeight: 40 } }
```

It samples every 50ms for `settle`ms and fails if the element leaves the page or drops below
`minHeight`. The window **is** the settle — the runner does not also wait `settle` before polling,
because that would sample only after the fault had passed. Pair it with `repeat`/`interval` to
express a fast re-tap:

```js
click: '.achievement-item >> nth=2 >> button[aria-pressed]',
repeat: 2,        // click it again
interval: 600,    // 600ms later — a fast double toggle
settle: 1600      // and watch it for 1.6s
```

Repeats are dispatched with `force: true` on purpose: a fast re-tap lands on a **moving** target, and
Playwright's stability wait would time out instead of clicking. All three assertions are **structural,
not visual** — none can see an element that is covered, transparent or off-screen. The regression
tests for the exit tier — held, in-place, reverse direction, and double-toggle — are in
[scripts/agent/examples/clicks.mjs](../scripts/agent/examples/clicks.mjs).

**A fresh page can only ever start from the INITIAL state**, so a control's second direction is
unreachable: the first click on a trophy always unlocks it, never locks it back. `seed` exists for
exactly that — it writes `localStorage` before the app boots, so the check can begin from a state
the page could not otherwise reach:

```js
{ name: 'Trophy row — un-locks', route: '/game/1245620',
  seed: { 'platworks:checked:1245620': { ROUNDTABLE_HOLD: true } },
  click: '.achievement-item >> nth=0 >> button[aria-pressed]',
  expect: { attr: { selector: '…same…', name: 'aria-pressed', equals: 'false' } } }
```

Note the key: achievement ids are **slugs**, not indices (`ROUNDTABLE_HOLD`, not `1`). A seed that
matches nothing is a silent no-op, and the check then fails as a confusing `aria-pressed` mismatch
rather than saying the seed did not apply.

When a probe fails the message names the element that actually received the click. Start there, not
with the handler.

### Two scoping traps, both of which fail silently

- **`>> nth=` counts in document order across the whole page.** `button[aria-expanded] >> nth=0` is
  the *navbar* account button, not a trophy's. Scope first:
  `.achievement-item >> nth=0 >> button[aria-expanded]`.
- **A trophy card has two hit zones by design** — the left rail toggles the check, the rest of the
  header expands the guide. Probing the whole row for either one alone reports correct layout as a bug.
  Pass both under `probe.controls`, or scope `probe.container` to the zone you mean.

### Probe the *edges* of a card, not just its centre

A control that fills its container has no dead zone; a control **inside** padded chrome has dead zones
on all four sides, and a centre-point check finds none of them. Every click check probes the centre
first; for anything with padding — a card row, a panel, a tile — pass a `container` so the corners and
edges are probed against the control as well:

```js
probe: { container: '.achievement-item', kinds: ['corners', 'edges'] }
```

Each point 5px inside a corner or edge must resolve to the control. A hit on an **ancestor** does not
count — that is precisely the "padding that is not clickable" failure. The target is scrolled into view
first, because a card below the fold reports a miss from `elementFromPoint` that is indistinguishable
from a dead control.

Two traps this catches that centre checks miss: **padding that is not clickable** (expand targets that
stop at the content box) and **content that is not clickable** (an overlay eating the control it was
meant to sit next to). It finds a third too — a control whose own corner is covered by an invisible
sibling. The navbar account button's bottom-right corner is swallowed by its `relative` wrapper at 390,
which no centre-point check can see.

### Look at the screenshots

`ui-audit.mjs` writes one PNG per route and width to `.tmp/audit-shots/`. **Open them.** A rendering
bug and an overlap bug are both obvious in an image and invisible to every other check.

### The README's two screenshots are committed — refresh them before you commit

`docs/screenshots/library.png` and `docs/screenshots/game-page.png` are **committed binaries**, and
`README.md` embeds them by path. Nothing in the build regenerates them, so a UI change leaves the
README advertising a build that no longer exists — and the drift is invisible in review, because a
PNG in a diff is just a PNG.

**Any commit that changes something a user can see in `src/routes/**`, `src/lib/components/**` or
`src/app.css` must refresh both files** unless that change provably cannot alter either view (a
comment, a type, a script under `scripts/`). When in doubt, regenerate: it is one command and
produces a no-op diff when nothing moved.

```bash
node scripts/agent/readme-shots.mjs                          # → docs/screenshots/
node scripts/agent/readme-shots.mjs --out-dir .tmp/…        # look before you commit
```

It starts no dev server — find one on `:5173`/`:4173` or run `npm run dev` first. Three things
about it that are not obvious:

- **State is seeded from localStorage, never from a Steam account.** `platworks:library` and
  `platworks:checked:{appId}` fully determine both views, so the output is deterministic without an
  API key, and the achievement IDs are read from `src/lib/data/games/*.json` — adding an achievement
  cannot desync it.
- **The scale is fixed at 1280×800 @2x.** It matches the committed PNGs; changing it turns every
  regeneration into a full-size diff in GitHub's media viewer.
- **Sync the alt text to whatever the run printed.** It prints the trophy count it seeded
  (`ok game-page (50/55 trophies)`). `README.md`'s `alt` names that count, so a catalogue that grows
  under a stale `alt` describes a game page that no longer exists. If you prefer not to hardcode a
  count, rewrite the `alt` to describe the *kind* of number instead — but pick one and keep it true.

### Never paste a screenshot into a reply — link the HTML

Screenshots are **your** verification step, not the user's deliverable. `shot.mjs` and
`ui-audit.mjs` exist so you can see what you built; the user reviews the real thing.

- In a `/ui-project` review reply, link the mockup's `.html` — workspace-relative, so it
  opens in the integrated browser. Never embed `shots/*.png`.
- In a verify reply, report the audit numbers in prose. Link a PNG only if asked.

A PNG cannot be clicked, cannot be opened in the integrated browser, pins the design to the
two widths that were rendered, and always shows the *default* state — so it hides exactly
the hover and click behaviour a mockup was drawn to demonstrate.

Two things follow that are easy to get wrong:

- **Still render them and still open them.** Removing the screenshot step removes the only
  check that sees a layout. The rule is about what you *send*, not what you *do*.
- **`shot.mjs --out-dir` is ignored for URL targets.** It writes `shot-<width>.png` into
  the current working directory, which is the repo root and is not gitignored. Pass an
  explicit `--out .tmp/ui/...` path when screenshotting a live route.
