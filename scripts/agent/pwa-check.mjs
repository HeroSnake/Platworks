/**
 * Verifies the PWA actually behaves like an installed app, in a real browser.
 *
 * `curl` cannot see any of this: a service worker only exists inside a browser
 * context, and offline behaviour only exists once you can take the network away.
 * Every assertion here is something that silently rots — a precache that grows to
 * 11MB, an `/api/steam/*` route that starts answering from cache and shows the
 * wrong completion state, an offline launch that 404s — and none of them surface
 * in `npm run check` or a build log.
 *
 * Requires a production build and a running preview server: the dev server
 * serves the service worker unbundled and without the manifest data.
 *
 * Usage:
 *   npm run build && npm run preview &
 *   node scripts/agent/pwa-check.mjs [--url http://localhost:4173]
 */
import { launchBrowser } from './lib/playwright.mjs';
import { run } from './lib/cli.mjs';

const args = process.argv.slice(2);
const urlIndex = args.indexOf('--url');
const BASE = urlIndex !== -1 ? args[urlIndex + 1] : 'http://localhost:4173';

const failures = [];
const notes = [];

/** Records a passed or failed expectation; the detail is for the failure only. */
function check(name, ok, detail = '') {
	const line = `ok   ${name}`;
	(ok ? notes : failures).push(ok || !detail ? line : `FAIL ${name} — ${detail}`);
}

/** Waits for the page's service worker to become active and controlling. */
async function activated(page) {
	return page.evaluate(async () => {
		const reg = await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
			);
		}
		return Boolean(reg.active);
	});
}

async function main() {
	const browser = await launchBrowser();
	const context = await browser.newContext({ serviceWorkers: 'allow' });
	const page = await context.newPage();

	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));

	try {
		// --- registration ---------------------------------------------------
		await page.goto(BASE, { waitUntil: 'load' });
		check('service worker registers', await activated(page));

		// --- precache contents ----------------------------------------------
		const cache = await page.evaluate(async () => {
			const keys = await caches.keys();
			const shell = keys.find((k) => k.startsWith('platworks-') && !k.startsWith('platworks-cdn-'));
			const all = shell
				? (await (await caches.open(shell)).keys()).map((r) => new URL(r.url).pathname)
				: [];
			return { shell, all };
		});

		check('cache is versioned', /platworks-\d+/.test(cache.shell ?? ''), `got ${cache.shell}`);
		const precachedArt = cache.all.filter((p) => p.startsWith('/images/games/'));
		check(
			'precache excludes game artwork',
			precachedArt.length === 0,
			`${precachedArt.length} image(s) precached — install would download all 11MB`
		);
		check('precache includes the offline page', cache.all.includes('/offline.html'));
		check('precache includes the manifest', cache.all.includes('/manifest.json'));
		check(
			'precache includes hashed build output',
			cache.all.some((p) => p.startsWith('/_app/immutable/'))
		);
		check(
			'precache includes the start URL',
			cache.all.includes('/'),
			'without it a cold offline start lands on /offline.html instead of the app'
		);

		// --- offline launch -------------------------------------------------
		// The navigation is network-first, so what answers is the cached copy of
		// `/`. A 200 with real content proves the whole chain works: HTML, hashed
		// chunks, and the stylesheet.
		await context.setOffline(true);

		const offlineResponse = await page.goto(BASE, { waitUntil: 'load' }).catch((e) => {
			failures.push(`FAIL offline launch — navigation threw: ${e.message}`);
			return null;
		});
		check(
			'offline launch returns 200',
			offlineResponse?.status() === 200,
			`status ${offlineResponse?.status()}`
		);

		// This must show the real app, NOT the offline page. Both are a 200 with
		// the word "PlatWorks" in them, so matching on that alone would pass even
		// when the app never opened offline — which is exactly what happened before
		// `/` was added to the precache.
		const text = await page.locator('body').innerText().catch(() => '');
		check(
			'offline launch renders the app, not the offline page',
			/PlatWorks/i.test(text) && !/needs a connection/i.test(text),
			`saw "${text.trim().slice(0, 60)}"`
		);

		// Regression guard for a `Vary: Origin` miss: SvelteKit 3 pulls its chunks in
		// with a dynamic `import()` (not a `<script src>` tag), and sends an
		// `Origin` header the precached request never had. Without `ignoreVary`
		// every JS chunk misses the cache and fails offline while stylesheets keep
		// working — so the SSR'd markup still paints and only the app is dead.
		//
		// Asserting on script tags would miss this entirely (there are none), and
		// asserting the page rendered would pass while broken. The only honest
		// test is whether the app is actually interactive: click a game card and
		// require the client-side router to take over.
		const interactive = await page.evaluate(async () => {
			const card = document.querySelector('a[href^="/game/"]');
			if (!card) return { clicked: false };
			card.click();
			await new Promise((r) => setTimeout(r, 1200));
			return { clicked: true, url: location.pathname };
		});
		check(
			'offline app is interactive (client router alive)',
			interactive.clicked && /^\/game\//.test(interactive.url ?? ''),
			`a card click left the URL at "${interactive.url}" — the JS chunks did not load`
		);

		// --- sync must NOT be answered from cache ---------------------------
		const sync = await page.evaluate(async () => {
			try {
				const res = await fetch('/api/steam/profile?steamId=76561197960287930');
				return { status: res.status };
			} catch {
				return { failed: true };
			}
		});
		check(
			'offline /api/steam/* is not served from cache',
			sync.failed === true || sync.status >= 400,
			sync.failed
				? 'fetch rejected (correct — no network)'
				: `resolved with status ${sync.status} — a cached sync response shows the wrong completion state`
		);

		await context.setOffline(false);

		// --- a route never visited while online -----------------------------
		// `/offline.html` is precached, so an unvisited route must resolve to it
		// rather than to a browser error page.
		await context.setOffline(true);
		const cold = await page
			.goto(`${BASE}/game/2050650`, { waitUntil: 'domcontentloaded' })
			.catch(() => null);
		const coldText = await page.locator('body').innerText().catch(() => '');
		check(
			'unvisited route falls back to the offline page',
			coldText.length > 0 && /offline/i.test(coldText),
			`status ${cold?.status()}, saw "${coldText.trim().slice(0, 60)}"`
		);
		await context.setOffline(false);

		check('no uncaught page errors', errors.length === 0, errors.join(' | '));
	} finally {
		await context.close();
		await browser.close();
	}

	console.log(notes.map((n) => `  ${n}`).join('\n'));
	if (failures.length) {
		console.error(`\n${failures.map((f) => `  ${f}`).join('\n')}`);
		console.error(`\n${failures.length} PWA check(s) failed.\n`);
		process.exit(1);
	}
	console.log(`\nAll ${notes.length} PWA checks passed.`);
}

run(main);