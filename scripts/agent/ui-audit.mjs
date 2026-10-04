/**
 * Browser audit of the running app.
 *
 * This is the executable form of the checks in platworks-ui.agent.md §6 and of
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
        url: '/game/'                      // substring of location.href
      },
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
    }
  ];

Without \`expect\`, the check asserts the click changed nothing and fails — an
unasserted click is not a test. \`accept\` takes selectors for hits that
legitimately count, e.g. ['label'].

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

			if (check.expect) {
				// Resolve the assertion target through Playwright too: a spec that
				// selects with `>> nth=0` must be able to assert on that same node.
				const expect = { ...check.expect };
				if (expect.attr?.selector) {
					const el = await page.locator(expect.attr.selector).first().elementHandle();
					expect.attr = { ...expect.attr, el };
				}

				const before = await page.evaluate(readState, expect);
				await page.click(control, { timeout: 5000 });
				await page.waitForTimeout(300);
				const after = await page.evaluate(readState, expect);

				for (const [key, value] of Object.entries(after)) {
					if (key === 'url') continue;
					if (before[key] === value) {
						failures.push(`no observable change: ${key} stayed ${JSON.stringify(value)}`);
					}
				}
				if (check.expect.url && !after.url.includes(check.expect.url)) {
					failures.push(`url did not reach ${JSON.stringify(check.expect.url)}: ${after.url}`);
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
				await page.click(control, { timeout: 5000 });
				await page.waitForTimeout(300);
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