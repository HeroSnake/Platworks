/**
 * The UI audit rules, as functions that run inside the page.
 *
 * `page.evaluate(fn)` serialises ONE function and executes it in the browser, so
 * everything a check needs — including its own helpers — has to live inside that
 * function. Splitting `visible()` out at module scope and calling it from
 * `auditPage` throws `ReferenceError: visible is not defined` at runtime, which is
 * why the helpers below are scoped inside it.
 *
 * The rules themselves live in .agents/ui.md §6. This file is the
 * executable copy: if a rule changes there, change it here too.
 */

/** Selector for everything that must clear the 40px tap-target floor. */
export const INTERACTIVE_SELECTOR = [
	'a[href]',
	'button',
	'input:not([type="hidden"])',
	'select',
	'textarea',
	'summary',
	'[role="button"]',
	'[role="radio"]',
	'[role="checkbox"]',
	'[role="switch"]',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

/** Controls the duplicated-control check groups by identity. */
export const CONTROL_SELECTORS = ['[role="radiogroup"]', '[role="radio"]', 'select', 'input[type="text"]'];

/**
 * Runs every geometry check on the current page in one round trip.
 *
 * options: { interactive, controls, minHeight, reach }
 *   `reach`  how far outside its own box a control must still receive a click
 * result:  { overflow, controls, targets }
 */
export function auditPage(options) {
	const interactive = options.interactive;
	const controlSelectors = options.controls;
	const minHeight = options.minHeight;
	const reach = options.reach;

	/** A short, stable label, used to detect the *same* control rendered twice. */
	function describe(el) {
		const aria = el.getAttribute('aria-label');
		if (aria) return `aria-label="${aria}"`;
		const labelledBy = el.getAttribute('aria-labelledby');
		if (labelledBy) {
			const text = labelledBy
				.split(/\s+/)
				.map((id) => (document.getElementById(id)?.textContent ?? '').trim())
				.filter(Boolean)
				.join(' ');
			if (text) return `aria-labelledby="${text}"`;
		}
		const name = el.getAttribute('name');
		if (name) return `name="${name}"`;
		const placeholder = el.getAttribute('placeholder');
		if (placeholder) return `placeholder="${placeholder}"`;
		if (el.id) return `#${el.id}`;
		const tag = el.tagName.toLowerCase();
		const label = el.closest('label');
		if (label && label.textContent.trim()) {
			return `${tag} in <label> "${label.textContent.trim().slice(0, 40)}"`;
		}
		const text = (el.textContent ?? '').trim();
		return text ? `${tag} "${text.slice(0, 40)}"` : tag;
	}

	/**
	 * Visible = rendered, non-zero box, not hidden, not transparent.
	 * Something that fails this is not a control the user can see, so it must
	 * not count towards the duplicate check either.
	 */
	function visible(el) {
		const style = getComputedStyle(el);
		if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
		if (style.pointerEvents === 'none') return false;
		const rect = el.getBoundingClientRect();
		// A zero box means `content-visibility: auto` skipped it, or it collapsed.
		if (rect.width === 0 || rect.height === 0) return false;
		return true;
	}

	// -- 1. horizontal overflow ------------------------------------------------
	const docEl = document.documentElement;
	const scrollWidth = Math.max(docEl.scrollWidth, document.body ? document.body.scrollWidth : 0);
	const overflow = {
		scrollWidth,
		clientWidth: docEl.clientWidth,
		overflowPx: scrollWidth - docEl.clientWidth,
		overflow: scrollWidth > docEl.clientWidth
	};

	// -- 2. the same control rendered twice ------------------------------------
	// Counting raw elements would be wrong: the library legitimately renders
	// several radiogroups (scope, sort, completion) and search legitimately
	// appears once per breakpoint. The bug this catches is one filter row
	// rendered twice, so elements are grouped by identity and only a repeated
	// identity fails.
	const groups = new Map();
	const counts = [];
	let totalControls = 0;
	for (const selector of controlSelectors) {
		let count = 0;
		for (const el of document.querySelectorAll(selector)) {
			if (!visible(el)) continue;
			count++;
			const identity = describe(el);
			const key = `${selector} ${identity}`;
			const group = groups.get(key);
			if (group) group.count++;
			else groups.set(key, { selector, identity, count: 1 });
		}
		counts.push({ selector, count });
		totalControls += count;
	}
	const controls = { counts, duplicates: [...groups.values()].filter((g) => g.count > 1), total: totalControls };

	// -- 3. the tap-target floor, measured by hit-testing ----------------------
	// The bounding rect is NOT the hit area. `achievement_row.svelte` stretches
	// its toggle with `after:inset-0` and bleeds its check rail with
	// `before:-inset-y-*`, so the real target is far taller than the element. A
	// rect-based check fails those deliberately-oversized controls. A
	// pseudo-element hit-tests as its originating element, so walking outward
	// with `elementFromPoint` measures the truth.
	//
	// Only elements whose own box is under the floor are measured — everything
	// else passes without a hit test, which keeps the audit fast on a page of
	// trophy rows.
	const offenders = [];
	let smallest = null;
	for (const el of document.querySelectorAll(interactive)) {
		if (!visible(el)) continue;
		const rect = el.getBoundingClientRect();
		if (rect.height >= minHeight) continue;
		// Off-screen elements cannot be hit-tested meaningfully.
		if (rect.bottom < 0 || rect.top > docEl.clientHeight) continue;

		const hits = (x, y) => {
			const target = document.elementFromPoint(x, y);
			return !!target && (target === el || el.contains(target));
		};

		let measured = 0;
		for (const x of [rect.left + 1, rect.left + rect.width / 2, rect.right - 1]) {
			let top = rect.top;
			let bottom = rect.top;
			for (let y = rect.top; y >= rect.top - reach; y -= 2) {
				if (!hits(x, y)) break;
				top = y;
			}
			for (let y = rect.bottom; y <= rect.bottom + reach; y += 2) {
				if (!hits(x, y)) break;
				bottom = y;
			}
			measured = Math.max(measured, bottom - top);
		}

		const measuredHeight = Math.round(measured || rect.height);
		if (smallest === null || measuredHeight < smallest) smallest = measuredHeight;
		if (measuredHeight < minHeight) {
			offenders.push({
				tag: el.tagName.toLowerCase(),
				element: describe(el),
				rectHeight: Math.round(rect.height),
				measuredHeight,
				classes: String(el.className || '').slice(0, 80)
			});
		}
	}
	const targets = { offenders, smallest, minHeight };

	return { overflow, controls, targets };
}

/**
 * The doc's dead-zone probe.
 *
 * `point` is { container, control, controls, dx, dy, label, accept }
 * where `dx`/`dy` are fractions of the CONTAINER's box and every point must
 * resolve to one of the accepted controls (or something inside one of them).
 *
 * `container` and `control` are DOM elements, not selector strings. They arrive
 * as Playwright element handles because a click check may use engine syntax like
 * `[role="radiogroup"] [role="radio"] >> nth=1`, which `document.querySelector`
 * cannot parse. Callers that hold no handle pass a selector string instead.
 *
 * `container` defaults to the control, which is the common case: probe the inside
 * of a control's own corners and edges. Pass a separate container to probe the
 * *padding around* it — the card row, panel or tile — which is the case a centre
 * point and a control-only probe both miss, and the reason
 * `achievement_row.svelte` uses `after:inset-0` on its toggle.
 *
 * Use `controls` (plural) when a container legitimately has more than one hit
 * zone. A trophy card is the case: the left rail toggles the check and the rest
 * of the header expands the guide, and a probe demanding the check button own the
 * whole row is testing the wrong thing. Pass the row's own children as a list and
 * every point only has to reach one of them.
 *
 * A hit on an ANCESTOR does not count. That is precisely the "padding that is not
 * clickable" failure, and accepting it would hide the bug. `accept` is an explicit
 * allowlist for the rare legitimate case, such as a `<label>` wrapping a radio.
 */
export function probeEdges(point) {
	const resolve = (value) => (typeof value === 'string' ? document.querySelector(value) : value);

	// `control` is the single-target form; `controls` is the multi-zone form.
	const targets = (point.controls ?? [point.control]).map(resolve).filter(Boolean);
	if (!targets.length) return { ok: false, label: point.label, reason: 'control not found' };

	const container = resolve(point.container) ?? targets[0];

	// A control below the fold reports an elementFromPoint miss that is
	// indistinguishable from a dead one. Scroll the container in first.
	container.scrollIntoView({ block: 'center', behavior: 'instant' });

	const rect = container.getBoundingClientRect();
	const x = rect.left + point.dx * rect.width;
	const y = rect.top + point.dy * rect.height;

	const hit = document.elementFromPoint(x, y);
	if (!hit) {
		return { ok: false, label: point.label, reason: `nothing at (${Math.round(x)}, ${Math.round(y)})` };
	}

	const ok = targets.some((target) => hit === target || target.contains(hit));
	const accepted =
		!ok &&
		(point.accept ?? []).some((selector) => {
			try {
				return hit.matches(selector);
			} catch {
				return false;
			}
		});

	return {
		ok: ok || accepted,
		label: point.label,
		hit: `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}${
			hit.className ? `.${String(hit.className).trim().split(/\s+/).join('.')}` : ''
		}`.slice(0, 70),
		hitText: (hit.textContent ?? '').trim().slice(0, 30)
	};
}

/**
 * Reads the observable state a click is expected to change. Never assert on
 * "the click did not throw" — every key here is something a user can see, or
 * would notice losing.
 *
 * `spec.attr` may carry `el`, a DOM element resolved by the caller through
 * Playwright, or `selector`, a plain string. It needs `el` whenever the selector
 * uses engine syntax (`>> nth=0`), which `document.querySelector` cannot parse.
 */
export function readState(spec) {
	const state = {};
	for (const key of spec.storage ?? []) {
		state[`storage:${key}`] = localStorage.getItem(key);
	}
	if (spec.attr) {
		const el = spec.attr.el ?? (spec.attr.selector ? document.querySelector(spec.attr.selector) : null);
		const name = spec.attr.name ?? 'aria-checked';
		state[`attr:${name}`] = el ? el.getAttribute(name) : null;
	}
	if (spec.htmlAttr) {
		state[`html@${spec.htmlAttr}`] = document.documentElement.getAttribute(spec.htmlAttr);
	}
	// Live match count for a selector. This is the only observable that can assert a
	// LIST did or did not change length, which is what a filter is: `storage` proves
	// the filter was written, `attr` proves a control is marked — neither can say the
	// rendered rows actually went away, or stayed long enough to animate.
	if (spec.count) {
		state[`count:${spec.count.selector}`] = String(document.querySelectorAll(spec.count.selector).length);
	}
		// Position of an element among its siblings' matches. This is the assertion that a
		// list kept a row WHERE it was: a held row that gets appended instead of filtered
		// back into place still leaves the count correct, but moves to the end, which
		// reads on screen as the card the player just tapped jumping to the bottom.
		if (spec.index) {
			const el = spec.index.el ?? document.querySelector(spec.index.selector);
			const row = el?.closest?.(spec.index.within) ?? null;
			const all = [...document.querySelectorAll(spec.index.within)];
			state[`index:${spec.index.within}`] = row ? String(all.indexOf(row)) : 'gone';
		}
		state.url = location.href;
		return state;
	}

/**
 * Collects console errors, uncaught exceptions and failed document requests.
 * These fire on the Node side, so this is a listener factory rather than a
 * page-side function.
 */
export function attachErrorCollectors(page) {
	const errors = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
	});
	page.on('requestfailed', (req) => {
		// A failed font or icon is noise; a failed document is not.
		if (req.resourceType() === 'document') errors.push(`requestfailed: ${req.url()}`);
	});
	return errors;
}