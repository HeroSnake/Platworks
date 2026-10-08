/**
 * The pre-hydration boot screen.
 *
 * `src/app.html` paints a boot screen inline, before `%sveltekit.body%` exists,
 * so the window between "HTML parsed" and "Svelte mounted" is never an empty
 * rectangle. This module is the other half: the app tells the screen what is
 * actually happening, and the screen retires itself.
 *
 * ## Why this cannot live in a Svelte component
 *
 * app.css is a separate render-blocking stylesheet (`<link>` to a hashed
 * `_app/immutable/assets/*.css`). Anything that renders before that request
 * lands paints unstyled. So the boot screen's markup and its critical CSS are
 * inline in `app.html`, and it is driven through `window` rather than through
 * props — a component would hydrate *after* the gap it exists to cover.
 *
 * ## The phases are real, not decorative
 *
 * Each one is a thing that genuinely happens during a cold start, in this order:
 *
 * 1. `parse` — the inline script in `app.html`, before the bundle is requested.
 *    On a cold cache this is the *only* phase the user actually waits on, and it
 *    can be hundreds of milliseconds.
 * 2. `mount` — module scope below, i.e. the bundle has been downloaded and is
 *    now executing. That is a real, observable moment.
 * 3. `ready` — the route's hydration gate, once persisted state is in and the
 *    grid can paint its real contents.
 *
 * Do not add a phase that is not a milestone the app genuinely passes through.
 * A status line claiming work which never runs is worse than no status line —
 * in particular there is **no Steam call during boot**: `refreshProfile()` runs
 * on demand after a sync, never on load.
 *
 * ## Phase order is enforced, not assumed
 *
 * Svelte 5 flushes child effects before parent effects, so a route's `ready`
 * fires before the layout's own effect would have. Ordering is therefore
 * guarded in the inline script (it ignores regressions) and `mount` is signalled
 * from module scope rather than from an effect — see the note there.
 *
 * ## The minimum display time
 *
 * On a warm start the whole sequence finishes in well under a second, and a
 * status line that changes twice in 150ms is unreadable. `MIN_DISPLAY_MS`
 * therefore holds the screen for a beat so the last phase is legible. It is a
 * *floor*, not a delay: a genuinely slow cold start has already exceeded it and
 * retires the instant it is ready.
 */

import { browser } from '$app/env';

/** Milestones a cold start genuinely passes through. */
export type BootPhase = 'mount' | 'ready';

interface BootBridge {
	/** Advance to a milestone. */
	phase(phase: BootPhase): void;
	/** The app has rendered its real first frame; retire the screen. */
	done(): void;
}

declare global {
	interface Window {
		__pwBoot?: BootBridge;
	}
}

/**
 * Reports a milestone to the boot screen, if one is on screen.
 *
 * Safe to call unconditionally from any route or component: it is a no-op
 * during SSR, after the screen has retired, and on pages that never boot.
 */
export function bootPhase(phase: BootPhase): void {
	if (!browser) return;
	window.__pwBoot?.phase(phase);
}

/**
 * Retires the boot screen.
 *
 * Called from a route's hydration gate, never on a timer: a screen that retired
 * on its own schedule would hide a half-rendered app. `linktest` has no gate
 * and does not need the screen, which is why these are explicit calls rather
 * than something fired automatically on mount. The inline script carries a
 * 4s safety net for a route that forgets.
 */
export function bootDone(): void {
	if (!browser) return;
	window.__pwBoot?.done();
}

/**
 * The `mount` milestone fires from module scope, not from an effect.
 *
 * Module scope of an imported module runs as soon as the bundle is downloaded
 * and starts executing — which is exactly what "the bundle has arrived" means,
 * and it happens before any component effect. An effect in the layout cannot
 * say this: Svelte flushes child effects first, so the route's `ready` would
 * already have fired and the phase would be discarded as a regression.
 */
bootPhase('mount');