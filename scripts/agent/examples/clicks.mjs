/**
 * Click checks for the live app — the example file `ui-audit.mjs --help` refers to.
 *
 * Copy it next to the change you are verifying, edit it, and run:
 *   node scripts/agent/ui-audit.mjs --checks .tmp/clicks.mjs
 *
 * Every check is asserted on an observable state change, never on "the click did
 * not throw", and each runs on a fresh page.
 *
 * Two scoping rules, both learned the hard way:
 *
 *  - `>> nth=` counts in DOCUMENT order across the whole page. `button[aria-expanded]
 *    >> nth=0` is the navbar account button, not a trophy's. Scope first:
 *    `.achievement-item >> nth=0 >> button[aria-expanded]`.
 *
 *  - A trophy card has TWO hit zones by design: the left rail toggles the check,
 *    the rest of the header expands the guide (see .agents/ui.md). Probing
 *    the whole row for either one alone is testing the wrong thing — pass both
 *    under `controls`, or scope the container to the zone you mean.
 */
export default [
	{
		name: 'Library sort — Completion',
		route: '/',
		click: '[aria-label="Sort games"] [role="radio"] >> nth=1',
		expect: { storage: ['platworks:sort'] }
	},
	{
		// Scope is deliberately session-only (see .agents/state.md), so
		// aria-checked is the honest observable here — not a storage key.
		name: 'Library scope — My Library',
		route: '/',
		click: '[aria-label="Library scope"] [role="radio"] >> nth=0',
		expect: {
			attr: { selector: '[aria-label="Library scope"] [role="radio"] >> nth=0', name: 'aria-checked', equals: 'true' }
		}
	},
	{
		name: 'Game page — completion filter: Locked',
		route: '/game/1245620',
		width: 390,
		click: '[aria-label="Completion filter"] [role="radio"] >> nth=1',
		expect: { storage: ['platworks:filter:1245620'] }
	},
	{
		name: 'Trophy type chip — Missable',
		route: '/game/1245620',
		click: 'button[aria-pressed] >> nth=1',
		expect: { storage: ['platworks:typeFilter:1245620'] }
	},
	{
		// The dead-zone case: probe the whole header row and accept EITHER zone.
		// This is what proves no part of the card is inert padding.
		name: 'Trophy card — whole header row is a hit zone',
		route: '/game/1245620',
		click: '.achievement-item >> nth=0 >> button[aria-label^="Mark"]',
		probe: {
			container: '.achievement-item >> nth=0',
			controls: [
				'.achievement-item >> nth=0 >> button[aria-label^="Mark"]',
				'.achievement-item >> nth=0 >> button[aria-expanded]'
			],
			kinds: ['corners', 'edges']
		},
		expect: { storage: ['platworks:checked:1245620'] }
	},
	{
		// The expand half alone. Scoped to its own box: the row's left strip
		// belongs to the check rail, so probing the whole row for this one would
		// report a correct layout as a bug.
		name: 'Trophy card — text area expands the guide',
		route: '/game/1245620',
		click: '.achievement-item >> nth=0 >> button[aria-expanded]',
		probe: { kinds: ['corners', 'edges'] },
		expect: {
			attr: { selector: '.achievement-item >> nth=0 >> button[aria-expanded]', name: 'aria-expanded', equals: 'true' }
		}
	},
	{
		// A small target, probed in its own box: the account button is 36x44 at
		// 390, so a 5px inset is a real fraction of its width.
		name: 'Account popover opens',
		route: '/',
		width: 390,
		click: 'button[aria-label="Steam account"]',
		expect: { attr: { selector: 'button[aria-label="Steam account"]', name: 'aria-expanded', equals: 'true' } }
		},
		{
			// A FILTER is a list, and the only way to assert one is its length — which is
			// what `count` is for. Under the Locked filter a toggle drops the row from the
			// list, but the row must be HELD for its exit animation first, so 300ms after
			// the click the count is unchanged. Paired with the storage key changing, that
			// is the whole behaviour: it is written, and it is still there to be seen.
			//
			// Without this a filter that destroyed the row on the same flush passed every
			// other assertion while showing the player no animation at all.
			name: 'Trophy row — held for its exit under the Locked filter',
			route: '/game/1903340',
			seed: { 'platworks:filter:1903340': 'locked', 'platworks:checked:1903340': {} },
			click: '.achievement-item >> nth=0 >> button[aria-pressed]',
			expect: {
				count: { selector: '.achievement-item' },
				storage: ['platworks:checked:1903340']
			}
		},
		{
			// `count` alone is not enough. Appending the held row instead of filtering it
			// back into place leaves the count perfectly correct while moving the card the
			// player just tapped to the BOTTOM of the list — which is exactly the bug it
			// looks like. `index` asserts the row is still where it was.
			name: 'Trophy row — leaves from where it was tapped, not the bottom',
			route: '/game/1903340',
			seed: { 'platworks:filter:1903340': 'locked', 'platworks:checked:1903340': {} },
			click: '.achievement-item >> nth=2 >> button[aria-pressed]',
			expect: {
				index: { selector: '.achievement-item >> nth=2', within: '.achievement-item' },
				storage: ['platworks:checked:1903340']
			}
		},
		{
			// The other direction: locking a trophy while the Done filter is on must play
			// the relock and then collapse, not vanish.
			name: 'Trophy row — held for its exit under the Done filter',
			route: '/game/1903340',
			seed: {
				'platworks:filter:1903340': 'unlocked',
				// Slugs, not indices. The Done filter also needs rows that already exist,
				// or there is nothing to tap.
				'platworks:checked:1903340': { LUMIERE: true, EXPLORATION: true, GHOST: true }
			},
			click: '.achievement-item >> nth=0 >> button[aria-pressed]',
			expect: {
				count: { selector: '.achievement-item' },
				storage: ['platworks:checked:1903340']
			}
		},
		{
			// A double toggle that CANCELS OUT must be a no-op on screen. It used to leave
			// the row held for its exit, so the exit fired anyway: the card collapsed and
			// faded for a row that had never left, then sprang back.
			//
			// Only `visible` can see this. The row is still in the DOM and still at the
			// same index throughout, so `count` and `index` both pass while it blinks —
			// it has to be POLLED to catch the frames in between.
			//
			// `interval` is inside the 900ms celebration on purpose: past that the card is
			// already collapsing under `pointer-events: none`, so a re-tap is not a thing
			// the player can do and this would be asserting the impossible.
			name: 'Trophy row — a double toggle that cancels out never blinks',
			route: '/game/1903340',
			seed: { 'platworks:filter:1903340': 'locked', 'platworks:checked:1903340': {} },
			click: '.achievement-item >> nth=2 >> button[aria-pressed]',
			repeat: 2,
			interval: 600,
			settle: 1600,
			expect: { visible: { selector: '.achievement-item >> nth=2', minHeight: 40 } }
		}
	];