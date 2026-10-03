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
| `game_card.svelte` | library card mirrors the game-page hero (full-bleed art, two scrims, title + chips overlaid); home grid is full-bleed and grows to 5 cols at `2xl` |
| `github_icon.svelte` | inline GitHub mark |
| `mobile_bar.svelte` | shared bottom bar for **both** pages |
| `src/routes/+layout.svelte` | navbar, account popover, View Transitions; owns `REPO_URL` and `platworks:steamId` |

### Shared component: `mobile_bar.svelte`

The mobile bottom bar is **one component used by both pages**. Do not fork a second copy; extend its props.

- Props: `percent`, `primary`, `secondary`, `status`, `statusTone`, `syncing`, `onsync`, `searchPlaceholder`, `bind:query`, `onsearch`, and an optional `panel` snippet
- Internally owns one `mode: 'none' | 'search' | 'filter'` — **search and filter are mutually exclusive**, so the bar only ever grows by one row
- The filter button is hidden when no `panel` snippet is passed
- The panel expands via the `.expand-panel` `grid-template-rows` technique in `app.css` (no DOM add/remove)

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

## 2. Progress bars: one green for "complete"

There are three progress indicators, and they all turn the **same** green at 100% so a finished game looks finished wherever you see it:

| Where | Incomplete | Complete |
|---|---|---|
| `game_card.svelte` (library) | `bg-steam-accent` | `bg-green-400` |
| `game/[appId]/+page.svelte` (header bar) | `from-steam-accent to-blue-400` | `from-green-400 to-green-300` |
| `mobile_bar.svelte` (bottom ring) | `stroke-steam-accent` | `stroke-green-400` |

`green-400` is the reference: it was already the "Complete" colour on the library card. Do not introduce a second shade of green, and do not swap `green-400` for the darker `--color-steam-green` theme token — that is the Metacritic badge, not the completion colour.

The header bar and the `%` beside it key off `progressPercent === 100`, **not** `completedCount === total`. `Math.round` means 999/1000 already displays "100%", and a bar that reads 100% must not still be blue. `game_card.svelte` keeps the stricter count check because it also drives the "Complete" label.

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