/**
 * Count a number up from 0 to its target, once, when it first appears on screen.
 *
 * WHY THIS IS JAVASCRIPT AND NOT A CSS TRANSITION
 *
 * The obvious CSS version animates a registered `@property` and renders it back
 * out through `counter-reset` + `content: counter(...)`. That moves the number
 * into a pseudo-element, which means it is absent from the accessibility tree,
 * absent from find-in-page, and absent from the SSR markup. A screen reader
 * announces nothing while the figure is on screen, and the value a user copies is
 * empty. Those are not trade-offs worth 700ms of smoothness, so the roll is a rAF
 * loop here and the number stays real text in the DOM.
 *
 * The cost of that choice is that `prefers-reduced-motion` has to be re-implemented
 * in TS: the `!important` block at the end of `app.css` collapses
 * `animation-duration` / `transition-duration`, and it does not apply to a rAF loop
 * at all. So this module checks the media query itself and writes the final value
 * immediately when it matches.
 *
 * `tabular-nums` is load-bearing on the caller's side — every counter in the app
 * already carries `.tabular`. Without it the digits change width as they roll and
 * the number shuffles sideways.
 */

import { browser } from '$app/env';

type Options = {
	/** Milliseconds for the whole roll. */
	duration?: number;
	/** Fire when the element first scrolls into view. Default: immediately. */
	onVisible?: boolean;
};

/** Every running roll, keyed by element, so `stop()` can cancel all of them. */
const running = new WeakMap<HTMLElement, number>();

export function stop(el: HTMLElement) {
	const id = running.get(el);
	if (id !== undefined) cancelAnimationFrame(id);
	running.delete(el);
}

export function countUp(el: HTMLElement, to: number, options: Options = {}) {
	if (!browser) return;
	const { duration = 700, onVisible = false } = options;

	stop(el);

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduced || duration <= 0) {
		el.textContent = String(to);
		return;
	}

	const from = 0;
	// Ease-out cubic. A linear count-up reads as a machine; an ease-out reads as
	// something arriving and settling, which is the same read as the rest of the
	// app's `--pw-motion-settle` motion.
	const ease = (p: number) => 1 - Math.pow(1 - p, 3);

	const run = (start: number) => {
		const frame = (now: number) => {
			const p = Math.min(1, (now - start) / duration);
			el.textContent = String(Math.round(from + (to - from) * ease(p)));
			if (p < 1) running.set(el, requestAnimationFrame(frame));
			else running.delete(el);
		};
		running.set(el, requestAnimationFrame(frame));
	};

	if (!onVisible || typeof IntersectionObserver === 'undefined') {
		run(performance.now());
		return;
	}

	// One observer per element, disconnected on the first intersection — a counter
	// rolls once, so an observer that outlives its job is a leak on a long page.
	const observer = new IntersectionObserver(
		(entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			observer.disconnect();
			run(performance.now());
		},
		{ threshold: 0.4 }
	);
	observer.observe(el);
}