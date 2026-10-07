/**
 * Regenerates the PNGs README.md embeds — `docs/screenshots/library.png` and
 * `docs/screenshots/game-page.png`.
 *
 * These two files are committed and they are the first thing a visitor sees, so a
 * UI change that never refreshes them leaves the README showing a build that no
 * longer exists. This script exists so refreshing them is one command instead of a
 * hand-rolled Playwright snippet that gets rewritten — and seeded slightly
 * differently — every time.
 *
 * Everything is seeded from localStorage, never from a Steam account: the app reads
 * progress out of `platworks:checked:{appId}`, so a screenshot can be fully
 * deterministic without an API key, a Steam ID, or a personal library. The game
 * files in `src/lib/data/games/` are the source of the achievement IDs, so the seed
 * follows the catalogue automatically — adding an achievement cannot desync it.
 *
 * Usage (from WSL, with the repo PATH exported):
 *
 *   node scripts/agent/readme-shots.mjs
 *   node scripts/agent/readme-shots.mjs --theme matrix
 *   node scripts/agent/readme-shots.mjs --only game-page
 *   node scripts/agent/readme-shots.mjs --out-dir .tmp/readme-shots   # look before you commit
 *
 * It does NOT start the dev server. Find one on :5173 or :4173, or start one.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './lib/playwright.mjs';
import { attachErrorCollectors } from './lib/ui-checks.mjs';
import { run } from './lib/cli.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 1280x800 at 2x — the size the committed PNGs have always been. Changing it makes
 * every regeneration a full-size diff in GitHub's media viewer, so treat it as fixed
 * unless the README layout itself changes.
 */
const WIDTH = 1280;
const HEIGHT = 800;
const SCALE = 2;

/** Long enough for the webfonts, the hero image and the count-up roll to settle. */
const SETTLE_MS = 900;

/** Matches `src/app.css`'s `:root` default. Named so a palette can be swapped per shot. */
const DEFAULT_THEME = 'ember';

/**
 * The library a visitor is shown. `done` is a fraction of that game's achievements,
 * chosen so the grid tells the truth about a real completionist: two platinums, two
 * nearly finished, three mid-run, one barely started, one untouched. A grid of
 * uniform half-full bars would sell the app less honestly than a real one does.
 */
const LIBRARY = [
	{ appId: 1145360, done: 1 },
	{ appId: 105600, done: 1 },
	{ appId: 1903340, done: 0.9 },
	{ appId: 1245620, done: 0.72 },
	{ appId: 2246340, done: 0.55 },
	{ appId: 1091500, done: 0.38 },
	{ appId: 1716740, done: 0.16 },
	{ appId: 292030, done: 0.08 },
	{ appId: 1174180, done: 0 }
];

/**
 * The game page. 38/42 matches the count the README's alt text promises, so the text
 * and the picture cannot drift apart — if you change one, change the other.
 */
const GAME_PAGE = { appId: 1903340, done: 0.9 };

function parseArgs(argv) {
	const args = { base: null, outDir: join(ROOT, 'docs', 'screenshots'), theme: DEFAULT_THEME, only: null };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => argv[++i];
		if (arg === '--base') args.base = next().replace(/\/$/, '');
		else if (arg === '--out-dir') args.outDir = next();
		else if (arg === '--theme') args.theme = next();
		else if (arg === '--only') args.only = next();
		else if (arg === '--help' || arg === '-h') args.help = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	if (args.only && !['library', 'game-page'].includes(args.only)) {
		throw new Error(`--only takes "library" or "game-page", not "${args.only}"`);
	}
	return args;
}

const HELP = `
readme-shots.mjs — regenerate the screenshots README.md embeds

  --out-dir <d>   Default: docs/screenshots
  --theme <id>    Palette from src/app.css. Default: ${DEFAULT_THEME}
  --only <name>   One of: library, game-page
  --base <url>    Default: first of :5173, :4173 that answers
`;

/** First of the dev/preview ports that answers, or a one-line reason it does not. */
async function findBase(explicit) {
	if (explicit) return explicit;
	for (const port of [5173, 4173]) {
		const url = `http://localhost:${port}`;
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
			if (res.ok) return url;
		} catch {
			/* nothing listening on this port */
		}
	}
	throw new Error(`No app on :5173 or :4173. Start one with \`npm run dev\`, then pass --base if it is elsewhere.`);
}

/** The game's achievement IDs, read from the catalogue so the seed cannot drift. */
async function achievementIds(appId) {
	const path = join(ROOT, 'src', 'lib', 'data', 'games', `${appId}.json`);
	const game = JSON.parse(await readFile(path, 'utf8'));
	const ids = (game.achievements ?? []).map((a) => a.id);
	if (!ids.length) throw new Error(`${appId}.json lists no achievements`);
	return ids;
}

/**
 * The `platworks:checked:{appId}` map for a game: the first `done` fraction of its
 * achievements, ticked. Ticking the first N rather than a random sample keeps the
 * screenshot byte-stable across runs, so a regeneration only diffs when the UI did.
 */
async function checkedMap(appId, done) {
	const ids = await achievementIds(appId);
	const count = Math.round(ids.length * done);
	const map = {};
	for (const id of ids.slice(0, count)) map[id] = true;
	return { map, total: ids.length, count };
}

/**
 * Seeds localStorage before the document exists, so the page hydrates into the shot's
 * state instead of rendering its empty one and then swapping. `addInitScript` runs at
 * document-start, which is early enough for `src/app.html`'s pre-paint theme read —
 * that is why the palette is seeded here and not applied with `setAttribute`
 * afterwards (which would flash).
 */
async function seed(page, entries) {
	await page.addInitScript((seeded) => {
		for (const [key, value] of Object.entries(seeded)) {
			localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
		}
	}, entries);
}

/**
 * Waits for the things a screenshot hides. `networkidle` is not enough on its own:
 * webfonts swap in after first paint and the count-up tiles animate over ~600ms, so
 * without these a committed README shot shows the fallback font or a half-rolled
 * number.
 *
 * The scroll is not optional. Achievement rows and game cards lazy-load, and a lazy
 * image below the fold stays `complete === false` forever — so "wait until every
 * image is complete" hangs on any page taller than the viewport. Scrolling once
 * triggers the loads; scrolling back means the capture is not taken mid-page.
 *
 * Images are waited on with `complete`, not `naturalWidth > 0`: a failed image is
 * `complete` too, and requiring a non-zero width hangs forever on exactly the case
 * worth reporting. `brokenImages` below is what turns that hang into a diagnostic.
 */
async function settle(page) {
	await page.evaluate(() => document.fonts.ready);

	await page.evaluate(async () => {
		const step = window.innerHeight;
		for (let y = 0; y <= document.body.scrollHeight; y += step) {
			window.scrollTo(0, y);
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		}
		window.scrollTo(0, 0);
	});

	await page.waitForFunction(
		() => [...document.images].every((img) => img.complete),
		null,
		{ timeout: 15000 }
	);
	await page.waitForTimeout(SETTLE_MS);
}

/** Images that finished loading but have no pixels — 404s, blocked CDNs, empty src. */
async function brokenImages(page) {
	return page.evaluate(() =>
		[...document.images]
			.filter((img) => img.complete && img.naturalWidth === 0)
			.map((img) => img.currentSrc || img.src || '(empty src)')
	);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(HELP);
		return;
	}

	const base = await findBase(args.base);
	await mkdir(args.outDir, { recursive: true });

	const jobs = [];

	if (!args.only || args.only === 'library') {
		const entries = { 'platworks:theme': args.theme, 'platworks:library': LIBRARY.map((g) => g.appId) };
		for (const g of LIBRARY) {
			const { map } = await checkedMap(g.appId, g.done);
					entries[`platworks:checked:${g.appId}`] = map;
		}
				jobs.push({ name: 'library', url: `${base}/`, seed: entries, out: join(args.outDir, 'library.png') });
	}

	if (!args.only || args.only === 'game-page') {
		const { map, total, count } = await checkedMap(GAME_PAGE.appId, GAME_PAGE.done);
		jobs.push({
			name: 'game-page',
			url: `${base}/game/${GAME_PAGE.appId}`,
			seed: {
				'platworks:theme': args.theme,
				[`platworks:checked:${GAME_PAGE.appId}`]: map,
				// A default filter would hide rows the README is advertising.
				[`platworks:filter:${GAME_PAGE.appId}`]: 'all',
				[`platworks:typeFilter:${GAME_PAGE.appId}`]: 'all'
			},
			out: join(args.outDir, 'game-page.png'),
			note: `${count}/${total} trophies`
		});
	}

	const browser = await launchBrowser();
	let failed = false;

	try {
		for (const job of jobs) {
			// A fresh context per shot: a seeded library must not leak into the next one.
			const context = await browser.newContext({
				viewport: { width: WIDTH, height: HEIGHT },
				deviceScaleFactor: SCALE,
				colorScheme: 'dark'
			});
			const page = await context.newPage();
			const errors = attachErrorCollectors(page);

			await seed(page, job.seed);
			await page.goto(job.url, { waitUntil: 'networkidle', timeout: 60000 });
			await settle(page);
						const broken = await brokenImages(page);
						await page.screenshot({ path: job.out, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
						await context.close();

						// A shot that captured a broken page still produces a PNG, which is why this
						// has to be a hard failure: GitHub would happily serve it forever.
						if (errors.length) {
							failed = true;
							console.error(`FAIL ${job.name} — ${errors.length} console/page error(s):`);
							for (const e of errors.slice(0, 5)) console.error(`     ${e}`);
						} else {
							const relative = job.out.startsWith(ROOT) ? job.out.slice(ROOT.length + 1) : job.out;
							console.log(`ok   ${job.name}${job.note ? ` (${job.note})` : ''} → ${relative}`);
						}

						// Not fatal — a README shot with a blank tile is still better than none, and
						// the agent has to open the PNG anyway. Printed so the blank tile in the image
						// has an explanation waiting for it.
						if (broken.length) {
							console.warn(`warn ${job.name} — ${broken.length} image(s) failed to load:`);
							for (const src of [...new Set(broken)].slice(0, 3)) console.warn(`     ${src}`);
						}
		}
	} finally {
		await browser.close();
	}

	if (failed) {
		console.error('\nWrote the PNGs anyway, but they capture a page with errors. Open them before committing.');
		process.exitCode = 1;
	}
}

await run(main);