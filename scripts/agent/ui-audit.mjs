/**
 * Browser audit of the running app.
 *
 * This is the executable form of the checks in .agents/ui.md §6 and of
 * phase 7 of /ui-project. It exists because `curl` cannot see horizontal
 * overflow, duplicated controls, tap-target sizes, console errors, or a control
 * that renders but does not respond to a click — every one of which has shipped.
 *
 * Usage:
 *   node scripts/agent/ui-audit.mjs                       # / + one game route, 390/768/1440
 *   node scripts/agent/ui-audit.mjs --routes /,/game/730
 *   node scripts/agent/ui-audit.mjs --widths 390
 *   node scripts/agent/ui-audit.mjs --base http://localhost:4173
 *   node scripts/agent/ui-audit.mjs --checks .tmp/ui/clicks.mjs   # declarative click checks
 *   node scripts/agent/ui-audit.mjs --no-shots
 *
 * Every check runs on a FRESH page. A check that switches tabs or empties a list
 * poisons the next one, and then you debug the wrong thing.
 *
 * Exit code is 1 when anything fails, so it can gate a build step.
 */
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, WIDTHS, HEIGHT } from './lib/playwright.mjs';
import { run } from './lib/cli.mjs';
import {
	INTERACTIVE_SELECTOR,
	CONTROL_SELECTORS,
	auditPage,
	probeEdges,
	readState,
	attachErrorCollectors
} from './lib/ui-checks.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The app's own tap-target floor. `h-9` is 36px and always fails. */
const MIN_TAP_HEIGHT = 40;

/** How far outside its own box a control must still receive the click. */
const EDGE_INSET = 5;

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
	const args = { routes: [], widths: WIDTHS, base: null, checks: null, shots: true, shotDir: null };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => argv[++i];
		if (arg === '--routes') args.routes = next().split(',').map((r) => r.trim()).filter(Boolean);
		else if (arg === '--widths') args.widths = next().split(',').map((w) => parseInt(w, 10));
		else if (arg === '--base') args.base = next().replace(/\/$/, '');
		else if (arg === '--checks') args.checks = next();
		else if (arg === '--shots') args.shots = true;
		else if (arg === '--no-shots') args.shots = false;
		else if (arg === '--shot-dir') args.shotDir = next();
		else if (arg === '--help' || arg === '-h') args.help = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

const HELP = `
ui-audit.mjs — browser audit of the running PlatWorks app

  --routes <a,b>     Routes to load. Default: / and one game route.
  --widths <a,b>     Viewport widths. Default: 390,768,1440
  --base <url>       Base URL. Default: first of :5173, :4173 that answers
  --checks <file>    Declarative click checks (see C below)
  --no-shots         Skip screenshots
  --shot-dir <dir>   Where screenshots land. Default: .tmp/audit-shots

C — click check file. Default-exports an array; only \`name\` and \`click\` are required.

  export default [
    {
      name: 'Sort games — name',
      route: '/',
      width: 390,                          // default: every audited width
      click: '[aria-label="Sort games"] [role=radio] >> nth=1',
      expect: {
        storage: ['platworks:sort'],       // must change value
        attr: { selector: '[role=radio][aria-checked=true]', name: 'aria-checked' },
        htmlAttr: 'data-theme',            // <html> attribute must change
                count: { selector: '.achievement-item', equals: '54' },  // how many match
                index: { selector: '.achievement-item', within: '.achievement-item' },  // and where it sits
                visible: { selector: '.achievement-item', minHeight: 40 },  // POLLED, see below
                url: '/game/'                      // substring of location.href
              },
              repeat: 2,                            // click the control this many times
              interval: 600,                        // gap between repeats. Default 300.
              settle: 1600,                         // watch this long after the last click. Default 300.
              probe: ['corners', 'edges']          // zones inside the control. Default.
            },
    {
      // A padded container: every point of the CARD must reach the control.
      // This is the case a centre-point click cannot see, and the reason
      // achievement_row.svelte puts after:inset-0 on its toggle.
      name: 'Trophy row — whole row expands',
      route: '/game/1245620',
      click: 'article:first-of-type button[aria-expanded]',
      probe: { container: 'article:first-of-type', kinds: ['corners', 'edges'] },
      expect: { attr: { selector: 'article:first-of-type button[aria-expanded]', name: 'aria-expanded', equals: 'true' } }
    },
    {
      // \`seed\` starts the page from a state it could not otherwise reach, because
      // every check gets a fresh page and a fresh page can only begin at the
      // INITIAL state. Use it for a control's SECOND direction — un-locking a
      // trophy, which always starts out unlocked. Values are JSON-encoded unless
      // they are already strings.
      name: 'Trophy row — un-locks',
      route: '/game/1245620',
      seed: { 'platworks:checked:1245620': { '1': true } },
      click: '.achievement-item >> nth=0 >> button[aria-pressed]',
      expect: { attr: { selector: '.achievement-item >> nth=0 >> button[aria-pressed]', name: 'aria-pressed', equals: 'false' } }
          },
          {
            // A FILTER is a list, and the only way to assert one is its length. Under a
            // completion filter, toggling a trophy drops it from the list — but it must be
            // HELD for its exit animation first, so 300ms after the click the row count is
            // still unchanged and only then does it fall. Without this, a filter that
            // destroyed the row immediately passes every other assertion while showing the
            // player nothing at all.
            name: 'Trophy row — held for its exit under a filter',
            route: '/game/1903340',
            seed: { 'platworks:filter:1903340': 'locked', 'platworks:checked:1903340': {} },
            click: '.achievement-item >> nth=0 >> button[aria-pressed]',
            expect: {
              count: { selector: '.achievement-item', equals: null },
              storage: ['platworks:checked:1903340']
            }
          }
        ];

Without \`expect\`, the check asserts the click changed nothing and fails — an
unasserted click is not a test. \`accept\` takes selectors for hits that
legitimately count, e.g. ['label'].

\`count\` and \`index\` sample BEFORE and AFTER the click; with no \`equals\` they
assert nothing changed. \`visible\` is different: it POLLS every 50ms for
\`settle\`ms and fails if the element ever leaves the page or drops below
\`minHeight\`. That is the only assertion that can catch a TRANSIENT fault — a row
that collapses to nothing and comes back inside the window ends exactly where it
started and passes every before/after assertion on earth.

Exit code 1 if any check fails.
`;

// ---------------------------------------------------------------- routes

/** Picks a real game route from the data dir so the audit never 404s. */
async function defaultRoutes() {
	const gamesDir = join(ROOT, 'src/lib/data/games');
	let files = [];
	try {
		files = (await readdir(gamesDir)).filter((f) => /^\d+\.json$/.test(f));
	} catch {
		return ['/'];
	}
	if (!files.length) return ['/'];
	files.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
	return ['/', `/game/${parseInt(files[0], 10)}`];
}

// ---------------------------------------------------------------- helpers

const slug = (route, width) =>
	`${route === '/' ? 'root' : route.replace(/^\//, '').replace(/[/?=&]/g, '-')}-${width}`;

/** Opens a page with error collection attached and the viewport set. */
async function openPage(browser, base, route, width) {
	const context = await browser.newContext({
		viewport: { width, height: HEIGHT },
		colorScheme: 'dark'
	});
	const page = await context.newPage();
	const errors = attachErrorCollectors(page);
	await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
	// Let hydration settle: a control audited before Svelte attaches its handler
	// reports as dead when it is merely not ready.
	await page.waitForTimeout(400);
	return { context, page, errors };
}

/**
 * Walks the dead-zone probe around `container`, asserting that `control` receives
 * every point. When container and control are the same locator this probes the
 * inside of the control's own corners and edges; when they differ it probes the
 * padding around it, which is the case a centre point cannot see.
 *
 * Selectors are resolved through Playwright's engine, not querySelector, so
 * `>> nth=1` works; the resolved handles are what crosses into the page.
 */
async function runProbes(page, { control, container, controls, kinds, accept }, inset) {
	const controlLocator = page.locator(control).first();
	const containerLocator = page.locator(container).first();
	// `controls` is the multi-zone form: a trophy card has two legitimate hit
	// zones, and every probe point only has to reach one of them.
	const extraHandles = controls
		? await Promise.all(controls.map((sel) => page.locator(sel).first().elementHandle()))
		: [];

	const [controlHandle, containerHandle] = await Promise.all([
		controlLocator.elementHandle(),
		containerLocator.elementHandle()
	]);
	const targets = [controlHandle, ...extraHandles].filter(Boolean);
	if (!targets.length) return [{ ok: false, label: 'probe', reason: `control not found: ${control}` }];

	// Scroll first: a control below the fold reports an elementFromPoint miss
	// that is indistinguishable from a dead one.
	const fractions = await page.evaluate(
		({ el, px }) => {
			el.scrollIntoView({ block: 'center', behavior: 'instant' });
			const r = el.getBoundingClientRect();
			const ix = px / Math.max(r.width, 1);
			const iy = px / Math.max(r.height, 1);
			return {
				topLeft: { dx: ix, dy: iy },
				topRight: { dx: 1 - ix, dy: iy },
				bottomLeft: { dx: ix, dy: 1 - iy },
				bottomRight: { dx: 1 - ix, dy: 1 - iy },
				leftEdge: { dx: ix, dy: 0.5 },
				rightEdge: { dx: 1 - ix, dy: 0.5 },
				topEdge: { dx: 0.5, dy: iy },
				bottomEdge: { dx: 0.5, dy: 1 - iy }
			};
		},
		{ el: containerHandle ?? controlHandle, px: inset }
	);

	const at = async (point, label) =>
		page.evaluate(probeEdges, { ...point, label, container: containerHandle, controls: targets, accept });

	const out = [await at({ dx: 0.5, dy: 0.5 }, 'centre')];
	if (!kinds || kinds.includes('centre')) return out;

	if (kinds.includes('corners')) {
		out.push(
			await at(fractions.topLeft, 'top-left'),
			await at(fractions.topRight, 'top-right'),
			await at(fractions.bottomLeft, 'bottom-left'),
			await at(fractions.bottomRight, 'bottom-right')
		);
	}
	if (kinds.includes('edges')) {
		out.push(
			await at(fractions.leftEdge, 'left-edge'),
			await at(fractions.rightEdge, 'right-edge'),
			await at(fractions.topEdge, 'top-edge'),
			await at(fractions.bottomEdge, 'bottom-edge')
		);
	}
	return out;
}

// ---------------------------------------------------------------- checks

async function auditRoute(browser, base, route, width, shotDir) {
	const { context, page, errors } = await openPage(browser, base, route, width);
	const failures = [];

	const { overflow, controls, targets } = await page.evaluate(auditPage, {
		interactive: INTERACTIVE_SELECTOR,
		controls: CONTROL_SELECTORS,
		minHeight: MIN_TAP_HEIGHT,
		reach: 64
	});

	if (overflow.overflow) {
		failures.push(
			`horizontal overflow: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth} (+${overflow.overflowPx}px)`
		);
	}
	for (const d of controls.duplicates) {
		failures.push(`duplicated control: ${d.selector} ${d.identity} appears ${d.count}×`);
	}
	for (const o of targets.offenders.slice(0, 12)) {
		failures.push(`tap target ${o.measuredHeight}px (< ${MIN_TAP_HEIGHT}): <${o.tag}> ${o.element} — ${o.classes}`);
	}
	if (targets.offenders.length > 12) {
		failures.push(`…and ${targets.offenders.length - 12} more under-sized targets`);
	}

	let shot = null;
	if (shotDir) {
		await mkdir(shotDir, { recursive: true });
		shot = join(shotDir, `${slug(route, width)}.png`);
		await page.screenshot({ path: shot, fullPage: true });
	}

	failures.push(...errors);
	await context.close();
	return { route, width, overflow, controls, targets, errors, shot, failures };
}

async function runClickCheck(browser, base, check, widths, shotDir) {
	const results = [];
	const route = check.route ?? '/';
	const control = typeof check.click === 'string' ? check.click : check.click?.selector;
	if (!control) throw new Error(`Click check "${check.name}" has no click selector`);
	// `probe` may be a plain array of zones, or an object naming the padded
	// container the control must fill. Both default to every zone.
	const zones = Array.isArray(check.probe) ? check.probe : (check.probe?.kinds ?? ['corners', 'edges']);
	const container = check.probe?.container ?? control;

	for (const width of check.width ? [check.width] : widths) {
		// Fresh page per check, exactly as the agent file requires.
		const { context, page, errors } = await openPage(browser, base, route, width);
		const failures = [...errors];

		try {
			// `seed` writes localStorage before the app boots, on a page that is
			// otherwise fresh. A fresh page can only ever start from the *initial*
			// state, so a check for a REVERSIBLE control — un-lock a trophy that
			// starts already unlocked-in — was unreachable: the first click always
			// moved it the same way. Seeding gives the second direction its own check
			// instead of leaving it unverified. It navigates to a lightweight route
			// first, because the value must be in storage before the route reads it.
			if (check.seed) {
				await page.goto(`${base}/linktest`, { waitUntil: 'domcontentloaded', timeout: 30000 });
				await page.evaluate((entries) => {
					for (const [key, value] of Object.entries(entries)) {
						localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
					}
				}, check.seed);
				await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
			}

			// Resolve through Playwright's engine so `>> nth=1` works, then scroll
			// the target into view: a control below the fold reports an
			// elementFromPoint miss indistinguishable from a dead control.
			const controlLocator = page.locator(control).first();
			if ((await controlLocator.count()) === 0) {
				failures.push(`selector not found: ${control}`);
			} else {
				await page.waitForTimeout(150);
				const probes = await runProbes(
					page,
					{ container, control, controls: check.probe?.controls, kinds: zones, accept: check.accept },
					EDGE_INSET
				);
				for (const p of probes) {
					if (!p.ok) {
						failures.push(
							`dead zone at ${p.label}: expected ${control}, got ${p.hit ?? 'nothing'}` +
								`${p.hitText ? ` "${p.hitText}"` : ''}${p.reason ? ` (${p.reason})` : ''}`
						);
					}
				}
			}

			// `repeat` clicks the same control again, for controls whose second direction
						// matters — a trophy toggled twice must end where it started. `settle` is how
						// long to watch afterwards; it doubles as the window a `visible` assertion is
						// polled over. Default 300ms lands inside the trophy exit animation, where a
						// row held for it is still on screen.
						const settle = check.settle ?? 300;
						const repeat = check.repeat ?? 1;
						const interval = check.interval ?? 300;
						// A repeat is a fast re-tap, and a fast re-tap lands on a MOVING target: the
						// row is mid-animation and Playwright's stability wait would time out rather
						// than click. `force` dispatches at the current box, which is what a human does.
						const clickOpts = { timeout: 5000, force: repeat > 1 };

						async function doClicks(afterWait) {
								for (let i = 0; i < repeat; i++) {
									if (i > 0) await page.waitForTimeout(interval);
									await page.click(control, clickOpts);
								}
								if (afterWait > 0) await page.waitForTimeout(afterWait);
						}

						if (check.expect) {
								// Resolve the assertion target through Playwright too: a spec that
								// selects with `>> nth=0` must be able to assert on that same node.
								const expect = { ...check.expect };
								if (expect.attr?.selector) {
									const el = await page.locator(expect.attr.selector).first().elementHandle();
									expect.attr = { ...expect.attr, el };
								}
								if (expect.index?.selector) {
									const el = await page.locator(expect.index.selector).first().elementHandle();
									expect.index = { ...expect.index, el };
								}

								const before = await page.evaluate(readState, expect);
								// A `visible` assertion IS the settle window: it polls across it, so
								// waiting here first would sample only after the fault had passed. Every
								// other assertion waits the full window and then samples once.
								await doClicks(check.expect.visible ? 0 : settle);
								const after = await page.evaluate(readState, expect);

								// A before/after pair cannot see a TRANSIENT fault: a row that collapses
								// to nothing and comes back inside the settle window ends exactly where it
								// started, and passes every other assertion here. `visible` polls instead,
								// and is the only assertion that can fail on what happened in between.
								if (check.expect.visible) {
									const { selector, minHeight = 40 } = check.expect.visible;
									const target = page.locator(selector).first();
									const until = Date.now() + settle;
									while (Date.now() < until) {
										const box = await target.boundingBox();
										if (!box) {
											failures.push(`${selector} left the page during the animation`);
											break;
										}
										if (box.height < minHeight) {
											failures.push(
												`${selector} collapsed to ${Math.round(box.height)}px during the ` +
													`animation, expected it to stay at ${minHeight}px or more`
											);
											break;
										}
										await page.waitForTimeout(50);
									}
								}

				for (const [key, value] of Object.entries(after)) {
					if (key === 'url') continue;
					// `count` and `index` are explicit claims, not change-detectors: they are how a
					// check asserts that something did NOT change (a row held for its exit,
					// and still sitting where it was). They are verified below, and exempt
					// from "everything else must move".
					if (key.startsWith('count:') || key.startsWith('index:')) continue;
					if (before[key] === value) {
						failures.push(`no observable change: ${key} stayed ${JSON.stringify(value)}`);
					}
				}
				if (check.expect.url && !after.url.includes(check.expect.url)) {
					failures.push(`url did not reach ${JSON.stringify(check.expect.url)}: ${after.url}`);
				}
				if (check.expect.count) {
					const name = `count:${check.expect.count.selector}`;
					const got = after[name];
					const want = check.expect.count.equals;
					if (want === null || want === undefined) {
						// No `equals` means "must be unchanged", which is the whole point for a
						// list that is supposed to hold still while something animates out of it.
						if (got !== before[name]) {
							failures.push(`${check.expect.count.selector} went ${before[name]} to ${got}, expected it to be held`);
						}
					} else if (got !== String(want)) {
						failures.push(`${check.expect.count.selector} matched ${got}, expected ${want}`);
					}
				}
				if (check.expect.index) {
				const name = `index:${check.expect.index.within}`;
				const got = after[name];
				const want = check.expect.index.equals ?? before[name];
				if (got !== String(want)) {
					failures.push(
						`${check.expect.index.selector} moved from position ${want} to ${got} — ` +
							`a row that is leaving must leave from where the player clicked it`
					);
				}
			}
			// An explicit `equals` is a stronger claim than "it changed": it
				// catches a control that changes to the wrong value.
				if (check.expect.attr?.equals !== undefined) {
					const name = check.expect.attr.name ?? 'aria-checked';
					const got = after[`attr:${name}`];
					if (got !== check.expect.attr.equals) {
						failures.push(`${name} is ${JSON.stringify(got)}, expected ${JSON.stringify(check.expect.attr.equals)}`);
					}
				}
			} else {
							await doClicks(settle);
							failures.push('no `expect` given — the click was not asserted on anything');
						}

			let shot = null;
			if (shotDir) {
				await mkdir(shotDir, { recursive: true });
				shot = join(shotDir, `click-${slug(check.name, width)}.png`);
				await page.screenshot({ path: shot, fullPage: true });
			}

			results.push({ name: check.name, route, width, shot, failures });
		} catch (e) {
			failures.push(e.message.split('\n')[0]);
			results.push({ name: check.name, route, width, shot: null, failures });
		}

		await context.close();
	}
	return results;
}

// ---------------------------------------------------------------- reporting

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function report(results) {
	console.log('');
	console.log('ROUTE                      WIDTH  OVERFLOW  CONTROLS  MIN TARGET  ERRORS');
	console.log('-'.repeat(70));
	for (const r of results) {
		const controls = r.controls.counts.map((c) => c.count).join('/');
		console.log(
			[
				r.route.padEnd(26),
				String(r.width).padEnd(6),
				(r.overflow.overflow ? red('yes') : green('none')).padEnd(9),
				(r.controls.duplicates.length ? red(controls) : green(controls)).padEnd(9),
				String(r.targets.smallest ?? '—').padEnd(11),
				(r.errors.length ? red(String(r.errors.length)) : green('0')).padEnd(7)
			].join(' ')
		);
	}
	console.log('');
	for (const r of results) {
		if (!r.failures.length) continue;
		console.log(red(`FAIL ${r.route} @ ${r.width}`));
		for (const f of r.failures) console.log(`   - ${f}`);
		if (r.shot) console.log(dim(`   screenshot: ${r.shot}`));
		console.log('');
	}
}

// ---------------------------------------------------------------- main

async function pickBase(explicit) {
	const candidates = explicit ? [explicit] : ['http://localhost:5173', 'http://localhost:4173'];
	for (const candidate of candidates) {
		try {
			const res = await fetch(candidate, { signal: AbortSignal.timeout(3000) });
			if (res.ok) return candidate.replace(/\/$/, '');
		} catch {
			/* not answering there */
		}
	}
	throw new Error(
		`No dev server answered at ${candidates.join(' or ')}.\n` +
			'Start one with `npm run dev` (or `npm run preview`) and re-run, or pass --base <url>.\n' +
			'The audit loads real routes in a real browser, so it needs a running server.'
	);
}

const args = parseArgs(process.argv.slice(2));
await run(async () => {
	if (args.help) {
		console.log(HELP);
		process.exit(0);
	}

	const base = await pickBase(args.base);
	const routes = args.routes.length ? args.routes : await defaultRoutes();
	const shotDir = args.shots ? (args.shotDir ?? join(ROOT, '.tmp/audit-shots')) : null;

	console.log(`Auditing ${base} — routes: ${routes.join(', ')} — widths: ${args.widths.join(', ')}`);

	const clickChecks = [];
	if (args.checks) {
		const mod = await import(pathToFileURL(args.checks).href);
		const list = mod.default ?? mod.checks ?? [];
		if (!Array.isArray(list)) throw new Error(`${args.checks} must default-export an array of click checks`);
		clickChecks.push(...list);
	}

	const browser = await launchBrowser();
	let failed = false;

	try {
		// Screenshots are for looking at, not for the machine: clear the old set so a
		// stale PNG from a previous run is never mistaken for this one's.
		if (shotDir) await rm(shotDir, { recursive: true, force: true });

		const results = [];
		for (const route of routes) {
			for (const width of args.widths) {
				results.push(await auditRoute(browser, base, route, width, shotDir));
			}
		}
		report(results);
		failed = results.some((r) => r.failures.length);

		if (clickChecks.length) {
			console.log(`\nClick checks (${clickChecks.length}) — each on a fresh page\n`);
			for (const check of clickChecks) {
				for (const r of await runClickCheck(browser, base, check, args.widths, shotDir)) {
					if (r.failures.length) {
						failed = true;
						console.log(red(`FAIL ${r.name} — ${r.route} @ ${r.width}`));
						for (const f of r.failures) console.log(`   - ${f}`);
						if (r.shot) console.log(dim(`   screenshot: ${r.shot}`));
					} else {
						console.log(green(`pass ${r.name} — ${r.route} @ ${r.width}`));
					}
				}
			}
		}
	} finally {
		await browser.close();
	}

	console.log('');
	console.log(failed ? red('UI audit FAILED') : green('UI audit passed'));
	process.exit(failed ? 1 : 0);
});