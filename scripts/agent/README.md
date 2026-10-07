# Agent toolkit

Reusable scripts for agent tasks in this repo. They exist so an agent does not
regenerate the same throwaway script on every run — and so the rules they encode
live in one reviewed file rather than in a fresh, subtly different copy each time.

**Run them with `node`, from WSL, with the repo's PATH exported:**

```bash
export PATH=/home/florent/.nvm/versions/node/v24.12.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
node scripts/agent/<script>.mjs --help
```

`.tmp/` is still the right place for *output* — mockups, ledgers, screenshots.
It is the wrong place for a script that will be written again next week.

## What is here

| Script | Job |
|---|---|
| `ui-audit.mjs` | Browser audit of the running app: overflow, duplicated controls, the 40px tap-target floor, console errors, screenshots, and declarative click checks. Implements [.agents/ui.md §6](../../.agents/ui.md) and phase 7 of [/ui-project](../../.github/prompts/ui-project.prompt.md). |
| `shot.mjs` | Renders a mockup (or any URL) at 390 and 1440, reports overflow, console errors and under-sized tap targets, and prints the markdown to embed in a reply. Phase 3 of `/ui-project`. **The PNGs are for the agent to look at, not to paste into a reply** — the user reviews the mockup's `.html` in their browser. For a URL target, pass an explicit `--out .tmp/ui/...`: `--out-dir` is only honoured for directory targets and otherwise writes `shot-<width>.png` into the repo root. |
| `readme-shots.mjs` | Regenerates the **committed** `docs/screenshots/library.png` and `game-page.png` that `README.md` embeds. State is seeded from localStorage, not a Steam account, so it is deterministic and key-free. Run it before committing anything that changes what a user sees — see [`.agents/ui.md`](../../.agents/ui.md) §6. |
| `new-mockup.mjs` | Scaffolds `.tmp/ui/{slug}/` with the real palette from `app.css`, the real fonts from `app.html`, real game data from `src/lib/data/games/`, and the `notes.md` skeleton. |
| `steam-achievements.mjs` | Fetches the Steam global achievement list once and parses it to `.tmp/game-data/{appId}/achievements.json`. Phase 2 of [/generate-game-data](../../.github/prompts/generate-game-data.prompt.md). |
| `ledger.mjs` | The fetch ledger as a CLI: `check` before every request, `add` before fetching, `resolve` after. Enforces the "log before fetch" rule that stops the same wiki index being opened four times. |
| `check-links.mjs` | Verifies `mapUrl` and `guide.sourceUrl` return 200. Reports a Cloudflare 403 as *unverifiable*, never as dead. |

| Library | Job |
|---|---|
| `lib/playwright.mjs` | Resolves the Playwright install without a hardcoded npx-cache hash. `playwright` is **not** a dependency; see [AGENTS.md §7](../../AGENTS.md). |
| `lib/ui-checks.mjs` | The audit rules as page-side functions. **This is the executable copy of the rules in [.agents/ui.md §6](../../.agents/ui.md) — change both together.** |
| `lib/cli.mjs` | Turns a thrown error into a one-line failure instead of a stack trace. |
| `examples/clicks.mjs` | A working click-check spec. Copy it, edit it, pass it to `--checks`. |

## The three rules these encode

Most of what follows is written down in the agent files. It is repeated here
because these scripts are where it is actually enforced.

**A check that cannot fail is not a check.** `ui-audit.mjs` measures the tap-target
floor by *hit-testing* rather than by reading `getBoundingClientRect()`, because
the rect is not the hit area: `achievement_row.svelte` stretches its toggle with
`after:inset-0` and bleeds its rail with `before:-inset-y-*`. A rect-based check
fails those deliberately-oversized controls; a pseudo-element hit-tests as its
originating element, so walking outward with `elementFromPoint` measures the truth.

**Assert on an observable change, never on "the click did not throw".** Every
click check takes an `expect` — a `localStorage` key, an `aria-*` attribute, the
`<html>` `data-theme`, a live element count, or the URL — and fails if the value did
not change. A check with no `expect` fails by design.

**A filter is a list, so `count`, `index` and `visible` are the only ways to assert
one.** `storage` proves the filter was *written* and `attr` proves a control is
*marked*; neither says what the rendered rows did. `count: { selector }` with no
`equals` asserts the count is **unchanged**, `index: { selector, within }` asserts
an element has not **moved**, and `visible` is **polled** every 50ms for `settle`ms
and fails if the element leaves or drops below `minHeight`. All three are exempt
from the "everything must change" rule for that reason.

The third exists because a before/after pair is blind to a *transient* fault: an
element that collapses to nothing and springs back inside the window ends exactly
where it started and passes every other assertion. That is precisely how a trophy
that blinked out of a filtered list on a double toggle survived a full audit.
`repeat` / `interval` express the fast re-tap that triggers it.

None of the three is *visual*: they cannot see an element that is covered,
transparent or off-screen, which is what `probe` is for.

**Geometry is not liveness.** A toolbar once shipped with every control
unclickable and passed every geometry check, because a stacking context had
buried it below the page. That is why the click checks exist, and why the probe
names *which* element actually received each point rather than just reporting a
miss.

## Two scoping traps in click checks

Both were found by running these checks against the app, and both fail silently —
the check runs, it just audits the wrong element.

- **`>> nth=` counts in document order across the whole page.**
  `button[aria-expanded] >> nth=0` resolves to the *navbar* account button, not a
  trophy's. Scope first: `.achievement-item >> nth=0 >> button[aria-expanded]`.
- **A trophy card has two hit zones by design** — the left rail toggles the
  check, the rest of the header expands the guide. Probing the whole row for
  either one alone reports correct layout as a bug. Pass both under `controls`,
  or scope the container to the zone you mean.

## What these scripts deliberately do not do

- They do not start or stop the dev server. `ui-audit.mjs` finds one on `:5173`
  or `:4173` and tells you to start one if there is none.
- They do not edit game JSON. `steam-achievements.mjs` writes a scratch list and
  reports the `id` gap the public page cannot fill; the game file is still yours.
- They do not delete `.tmp/`. Mockups and ledgers are the user's to keep.

## Verifying a change to these scripts

The tap-target and duplicate rules have false positives that only show up against
deliberately broken markup. If you change `lib/ui-checks.mjs`, check it still
catches a 20px button and still passes a 10px button that a pseudo-element
stretches to 90px — run the audit against the app (both should behave as they do
today) and reason about those two shapes explicitly.