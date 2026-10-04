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
| `achievement_row.svelte` | expandable trophy card: toggle + Steam icon + badges |
| `game_card.svelte` | library card is **dominated by the completion ring** (`h-24 sm:h-28`, percentage + count inside it), title beside it, Metacritic in the corner, no blurb; `rounded-lg`, home grid grows to 5 cols at `2xl` |
| `github_icon.svelte` | inline GitHub mark |
| `mobile_bar.svelte` | shared bottom bar for **both** pages |
| `src/routes/+layout.svelte` | navbar, account popover, View Transitions; owns `REPO_URL` and `platworks:steamId` |

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

The button is an **absolute overlay on the artwork's top-right corner at every breakpoint**. An earlier revision put it in the right rail on mobile, standing in for the chevron — but the card is now full-bleed and no longer has a chevron or a mobile/desktop split, so one overlay covers both. The card's `pt-16`/`sm:pt-20` reserves the band it sits in.

**Corners are `rounded-lg`, not `rounded-2xl`** (and the toggle button `rounded-md`). Large radii made full-bleed Steam artwork read as too soft next to the store's own rounded capsules. **The skeleton must match** (`rounded-lg`, `min-h-40 sm:min-h-48`) or the grid visibly jumps when the hydration gate opens.

### Card artwork: `object-contain object-top`, never `object-cover`

Steam header images are **460×215 and bake the game's logo into the artwork**. Filling a taller card with `object-cover` crops the sides off — which is exactly where the readable half of the logo is, so the title in the art gets cut and unreadable. An earlier revision compounded it by scaling to `h-[106%] w-[106%]` and centering, a deliberate overscan so rounded corners would not flash the wrapper fill. **That overscan is gone**: with `object-contain` the image is never clipped, so there is no corner to flash and no reason to zoom.

```
<img class="absolute inset-0 h-full w-full object-contain object-top" />
```

Contain leaves empty bars wherever the card is not exactly 460/215, and **the card's height is content-driven** (`min-h-40 sm:min-h-48` are floors, not fixed heights), so the bars are unavoidable and their position has to be chosen. Three rules make them invisible, and all three are load-bearing:

- **`object-top`.** A contained frame pinned to the top puts *every* bar at the bottom, where the overlay text and the solid part of the gradient already are. Centring splits them and leaves a seam halfway up the artwork.
- **The wrapper is `bg-steam-dark`, not `bg-steam-blue`.** That fill is what shows through the bars, and `steam-blue` (`#1b2838`) is a different colour from `steam-dark` (`#171a21`) — blue under a steam-dark gradient draws a hard horizontal line straight across the card. This is the single easiest thing to regress by "tidying" the wrapper colour.
- **`bg-gradient-to-t from-steam-dark from-35% to-transparent`.** The `from-35%` stop makes the bottom 35% fully opaque, which is where the bars land at every breakpoint, so the image's lower edge dissolves instead of terminating on a visible line. The remaining 65% is one long fade to fully transparent, leaving no band in which to spot a seam. Verified in the built CSS: `--tw-gradient-stops` resolves to steam-dark at `var(--tw-gradient-from-position)` then transparent, so the stop really is emitted — check it rather than trusting the class name.

Do not add a fixed height or an `aspect-*` utility to "fix" the bars: `overflow-hidden` would then clip a long title.

### Library scope: nothing above the grid may appear or disappear

Adding a game to **My Library** happens by tapping `+` on a card that is already on screen. Any control that then **inserts itself above the grid moves the card the user just pressed, out from under their finger** — it also threw a "browse the whole catalogue" panel in below the grid, which nobody scrolls to. Both were here and both are gone.

Three rules now hold the page still:

- **The scope switcher is unconditional.** `My Library (0)` / `All Games (29)` render on the very first paint; the only thing that changes on the first add is the count, `0 → 1`. A tab that exists from the start can only change state — a tab that appears late re-lays-out the page.
- **`scope` is authoritative — never coerce it.** Do **not** reintroduce an `effectiveScope` that rewrites `'mine'` to `'all'` when the library is empty: with the switcher always visible that would make the tab a silent no-op when clicked. `'mine'` with nothing in it is a real state with a real empty view ("Your library is empty" + a **Browse all games** CTA).
- **The first-run hint lives in a fixed `h-5` slot directly under the switcher.** One line tall whether or not it has text, so showing and hiding it costs nothing. It carries `aria-live="polite"`, because after a `+` tap that is the only place the selection change is announced.

The reserved 20px is deliberate and is the price of the stability. Do not reclaim it.

### The ring is the card, not a detail in it

Progression is what this app exists to show, so `game_card.svelte` spends its area on the completion ring and nothing else competes with it:

```
[ ★ 91 ]                          [ + ]   ← corners, out of the way
   ╭───────╮   Clair Obscur:
  │   55%  │   Expedition 33
  │  30/55 │
   ╰───────╯
```

- **Both numbers live inside the ring** — percentage over `completed/total`. The chip beside it that used to carry the count is gone; do not reintroduce a second `{percent}%` anywhere on the card.
- **`shortDescription` is not rendered.** It is still in the `+page.server.ts` payload (the avatar/menu and the game page use `steam`), so finding it in the HTML is not a bug — finding it in the *markup* is.
- **No "Complete" chip.** A green ring at 100% says it. This is why the stricter `completed === total` check no longer exists on this card.
- **Metacritic moved to `absolute left-2 top-2`.** It used to sit in a chip row under the title; beside a 112px ring there was no room for it, and it is not worth a row of vertical space.
- **The ring is beside the title, not above it.** Stacking them made the card tall enough that the letterbox bars outgrew the gradient's `from-35%` band and the artwork edge reappeared. **If you make the ring taller, re-check that band** — it is a percentage of a height that moves with the content.

`toggleMode` is `'add' | 'added' | 'remove'`, not a boolean: in **My Library** every card is already selected, so a check icon would read as "all done". It shows a **minus** there ("take this back out") and a **check** in **All Games** for games already added.

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

`game/[appId]/+page.svelte` renders one full-bleed hero — the title, the short description and the chips sit **on top of** the artwork, not under it. Do not reintroduce the old stacked "small image, then heading, then paragraph" layout.

```
┌────────────────────────────────────┐
│         (banner, object-cover)     │
│                    ─── scrim ───   │
│   REMNANT II®                      │
│   REMNANT II® pits survivors …     │
│   [Interactive Map] [★ 91]         │
└────────────────────────────────────┘
   ▓▓▓▓▓▓▓▓▓░░░░░░░░░░  78%       ← progress stays OUTSIDE
```

Three rules that are easy to undo by accident:

- **Two scrims, not one.** A flat `bg-steam-dark/45` plus a `bg-gradient-to-t` from `steam-dark`. Steam banners range from near-black to almost white, so the flat pass stops a bright one washing out the title and the gradient keeps the copy off the busiest band. Dropping either regresses some games.
- **`min-h` reserves the artwork; `pt` is only a floor.** The `min-h-56 / sm:min-h-72` is what guarantees a band of visible art above the text. The `pt` on the inner column exists so *short* copy still clears the image — keep it small so a long blurb grows the hero rather than getting clipped.
- **The image is decorative.** `alt=""` because the game name is the `h1` right there; a non-empty alt makes a screen reader announce the title twice. It also carries `fetchpriority="high"` — it is the page's LCP.

Full-bleed on phones via `-mx-4`, cancelling the container's `px-4`, with `sm:mx-0 sm:rounded-2xl` once `max-w-4xl` starts biting.

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

There are three, and they all turn the **same** green at 100% so a finished game looks finished wherever you see it:

| Where | Shape | Incomplete | Complete |
|---|---|---|---|
| `game_card.svelte` (library) | **dominant donut**, `h-24 sm:h-28`, % + count inside | `stroke-steam-accent` | `stroke-green-400` |
| `game/[appId]/+page.svelte` (header bar) | linear bar | `from-steam-accent to-blue-400` | `from-green-400 to-green-300` |
| `mobile_bar.svelte` (bottom ring) | donut ring, `h-9` | `stroke-steam-accent` | `stroke-green-400` |

The library card and the mobile bar share one ring construction: an `<svg viewBox="0 0 36 36">`
rotated `-rotate-90`, a track circle and a `stroke-linecap="round"` arc driven by
`stroke-dasharray={`${percent * 0.974} 100`}`. **The `0.974` is the circumference of
`r=15.5` in that viewBox** — it converts a percentage into a fraction of the 100-unit
dash path. Both rings put their numbers in the middle in `tabular-nums`.

Two rules that are easy to undo by accident:

- **Never put `stroke` in the transition list** (§4). Only `stroke-dasharray` animates. The
  colour flips on every completion, and transitioning it would repaint the card or the bar.
- **The ring owns the numbers.** On the library card both the percentage and the count are
  inside it — there is no chip repeating either.

`green-400` is the reference: it was already the "Complete" colour on the library card. Do not introduce a second shade of green, and do not swap `green-400` for the darker `--color-steam-green` theme token — that is the Metacritic badge, not the completion colour.

All three key off `progressPercent === 100`, **not** `completedCount === total`. `Math.round` means 999/1000 already displays "100%", and a ring that reads 100% must not still be blue.

## 3. Styling

- Tailwind CSS 4, **CSS-first** `@theme` in `src/app.css` — there is no `tailwind.config.js`.
- Dark-first: `bg-gray-900 text-gray-100` as the base; `dark:` only to override.
- Custom colours: `steam-dark`, `steam-blue`, `steam-light`, `steam-accent`, `steam-green`.
- Group classes: layout → spacing → sizing → colors → typography → effects.
- No inline styles when a Tailwind utility exists.

## 4. Animation

- View Transitions for page navigation **only** — never for in-page state.
- Expand/collapse via CSS `grid-template-rows` (`.expand-panel`); never DOM add/remove.
- **Never put `stroke` in an SVG's transition list.** The mobile bar's ring re-renders on every checkbox tap, so animating its colour repaints the whole bar; transition `stroke-dasharray` only.

## 5. Performance

- Animate only `transform` and `opacity` — GPU-composited properties.
- `content-visibility: auto` on long list items (see `.achievement-item` in `app.css`).
- Remove `transition-colors` / `transition-all` from frequently toggled elements.
- `will-change: transform` + `backface-visibility: hidden` on `sticky-nav` and `fixed-bottom-bar`.
- **Tap targets:** `h-11` (44px) in the navbar, `h-10` (40px) elsewhere. Never `h-9` — that is a desktop size and it is why the navbar used to feel cramped. Desktop keeps `h-9` via `sm:` overrides.
- The navbar bar is `h-16 sm:h-14`. Bump both the bar and its children together, or the 44px controls will not fit inside it.

## 6. Verifying a UI change

No browser harness is set up (Playwright's Chromium is missing system libs in WSL). Verify by reading the SSR output over `curl` and by reading the component source — full notes in [platworks-dev.agent.md](./platworks-dev.agent.md) §7.