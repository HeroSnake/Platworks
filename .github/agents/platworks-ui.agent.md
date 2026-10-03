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
| `game_card.svelte` | library card with the completion progress bar |
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