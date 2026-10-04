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
 *    the rest of the header expands the guide (see platworks-ui.agent.md). Probing
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
		// Scope is deliberately session-only (see platworks-state.agent.md), so
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
	}
];