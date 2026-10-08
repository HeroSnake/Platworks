/// <reference lib="webworker" />

import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';
import { self } from '$app/service-worker';

/**
 * The service worker. Kit bundles this to `/service-worker.js` and registers it
 * automatically (`serviceWorker.register` defaults to true), so neither this file
 * nor the app has to wire registration up.
 *
 * ## Kit 3 renamed the manifest exports
 *
 * The published SvelteKit service-worker docs still show `build` and `files` from
 * `$app/manifest`. In Kit 3 those are `immutable` and `assets`, and `version`
 * moved to `$app/env`. Importing the documented names is a build error here.
 *
 * ## What is cached, and why
 *
 * The app splits into three kinds of traffic needing opposite policies:
 *
 * | Traffic | Policy | Reason |
 * |---|---|---|
 * | `/_app/immutable/*` | cache-first | Content-hashed filenames. A given URL can only ever mean one byte sequence, so a hit is always correct and never needs revalidating. |
 * | `/images/games/*` | cache-first | Committed artwork, one header + one hero per game, and the path never changes meaning. This is what makes a game page usable with no signal. |
 * | Steam CDN achievement icons | cache-first, capped | Content-addressed URLs, so cache-first is safe. Capped because there are ~1650 of them and one game can otherwise fill the origin's quota. |
 * | Navigations (`/`, `/game/[appId]`) | network-first, cache fallback | The server load fetches Steam details on every request. Serving a cached page while online would show stale game names; the cache exists for when there is no network. |
 * | `/api/steam/*` | **never cached** | This is achievement sync. A stale hit would silently show the wrong completion state, which is worse than an error — both call sites already degrade to an error message when the request fails. |
 *
 * ## The precache is deliberately small
 *
 * `assets` is every file in `static/`, and that includes ~11MB of game artwork.
 * Precaching it would make install slow enough that Chrome may never fire the
 * install prompt, and would burn a large slice of the quota on images the user may
 * never open. So artwork is cached on demand and only the shell is precached.
 *
 * ## Updates
 *
 * There is deliberately no `skipWaiting()`. Without an update prompt, the next
 * build's worker waits until every tab using the current one has closed — the
 * only way to guarantee a running session never has its `_app/immutable` chunks
 * swapped underneath it mid-navigation. The cost is that a user who never closes
 * their last tab stays on the old build.
 */

const sw = self;

/** Cache names are versioned so a new build never reads a stale build's entries. */
const CACHE = `platworks-${version}`;
const CDN_CACHE = `platworks-cdn-${version}`;

/** How many Steam CDN responses to keep. See the table above. */
const CDN_CACHE_LIMIT = 300;

/**
 * The shell: hashed build output, plus the static files needed to boot and to
 * render the offline page. Deliberately excludes `/images/games/**`.
 *
 * Both manifest exports are arrays of `{ path }` objects, not strings — `map` to
 * `path` before using them as URLs. `assets` is typed as a union of the literal
 * file names in `static/`, so a path this filter has not accounted for is a
 * compile error rather than a silent 404 on install.
 */
const SHELL = [...immutable, ...assets]
	.map((entry) => entry.path)
	.filter((path) => !path.startsWith('images/games/'));

/**
 * `start_url`, precached separately so an installed app opens with no network.
 *
 * It is NOT part of `SHELL` because of how the first load works: a page loaded
 * before its worker activates is not intercepted, so on a first visit `/` is
 * never seen by the `fetch` handler and never cached by `networkFirst`. Without
 * this, every cold start with no signal lands on `/offline.html` instead of the
 * app, even though the user has clearly got this far before.
 */
const START_URL = '/';

/** Answered for any navigation that cannot be served from network or cache. */
const OFFLINE_URL = '/offline.html';

/** Steam's achievement icon hosts, matched on the registrable domain suffix. */
const STEAM_CDN = /(^|\.)steamstatic\.com$/;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);

			// The shell is atomic: `addAll` rejects as a unit, so a single missing
			// hash aborts the install and this worker never activates. That is the
			// behaviour we want for a genuinely broken build, and the reason the list
			// comes from the manifest rather than being hand-written. `reload`
			// bypasses the HTTP cache so an install can never precache a stale
			// copy of a hashed asset.
			await cache.addAll(SHELL.map((path) => new Request(path, { cache: 'reload' })));

			// The start URL is best-effort and deliberately NOT in the atomic list
			// above. `/` is server-rendered and calls Steam, so a transient Steam
			// outage must not be able to block activation of the whole worker — the
			// offline page still answers in that case.
			await cache.add(new Request(START_URL, { cache: 'reload' })).catch(() => {});
		})()
	);
	// No skipWaiting() — see the header comment.
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop caches belonging to earlier builds, including our own CDN cache.
			// The prefix match is deliberately narrow so unrelated caches on the
			// origin are left alone.
			const stale = await caches.keys();
			await Promise.all(
				stale
					.filter((key) => key.startsWith('platworks-') && key !== CACHE && key !== CDN_CACHE)
					.map((key) => caches.delete(key))
			);
			await sw.clients.claim();
		})()
	);
});

/**
 * Resolves a request against a cache, or null.
 *
 * `ignoreVary` is load-bearing. Vercel and the Vite preview server answer with
 * `Vary: Origin`, and the Cache API then refuses to match a stored response whose
 * stored request disagrees on `Origin`. The precache entries were created in
 * `install` with no `Origin` header, while SvelteKit emits its entry scripts as
 * `crossorigin` modules, which *do* send one — so every JS chunk silently missed
 * the cache and fell through to the network, and then failed outright offline.
 * Stylesheets happened to survive because `<link>` sends no `Origin`.
 *
 * Ignoring `Vary` is safe here because everything cached is same-origin and
 * content-addressed: one URL has exactly one correct body, so there is no
 * variation for the header to select between.
 */
async function fromCache(request: Request, cacheName: string) {
	const cache = await caches.open(cacheName);
	return (await cache.match(request, { ignoreVary: true })) ?? null;
}

/** Evicts the oldest entries until the cache is within `limit`. */
async function trim(cacheName: string, limit: number) {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();
	if (keys.length <= limit) return;
	// `cache.keys()` returns insertion order, so the head is the oldest.
	await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

/**
 * Cache-first. Only ever used for content-addressed URLs, where a hit is correct
 * by construction and the entry never needs invalidating.
 */
async function cacheFirst(request: Request, cacheName: string) {
	const cached = await fromCache(request, cacheName);
	if (cached) return cached;

	const response = await fetch(request);
	// An opaque cross-origin response has status 0 and is still worth caching, so
	// the guard has to admit it explicitly rather than testing `ok` alone.
	if (response.ok || response.type === 'opaque') {
		const cache = await caches.open(cacheName);
		await cache.put(request, response.clone());
		void trim(cacheName, CDN_CACHE_LIMIT);
	}
	return response;
}

/**
 * Network-first, falling back to the cache.
 *
 * Used for SSR navigations so an online user always sees what the server says.
 * The cached copy is used only when the network genuinely fails, which is what
 * makes the app openable with no signal.
 */
async function networkFirst(request: Request, cacheName: string) {
	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(cacheName);
			await cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cached = await fromCache(request, cacheName);
		if (cached) return cached;
		throw error;
	}
}

sw.addEventListener('fetch', (event) => {
	const request = event.request;

	// Never interfere with anything but GET. A POST must reach the network or fail
	// outright, and a Range request answered from cache would get the full body.
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	const isDataRequest = url.pathname.endsWith('__data.json');

	// Cross-origin: only Steam's CDN is ours to cache. Everything else — Google
	// Fonts, a user's avatar — passes straight through, because caching opaque
	// third-party responses is how a quota gets exhausted by data we never use.
	if (url.origin !== sw.location.origin) {
		if (STEAM_CDN.test(url.hostname)) {
			event.respondWith(cacheFirst(request, CDN_CACHE));
		}
		return;
	}

	// Achievement sync and profile lookups. A stale hit here would report the wrong
	// unlocked state as fact, so these bypass the cache and let a failure surface to
	// the page's existing error handling.
	if (url.pathname.startsWith('/api/steam/')) return;

	// The offline page itself: serve the precached copy without touching the network.
	if (url.pathname === OFFLINE_URL) {
		event.respondWith(fromCache(request, CACHE).then((hit) => hit ?? fetch(request)));
		return;
	}

	// Hashed build output.
	if (url.pathname.startsWith('/_app/immutable/')) {
		event.respondWith(cacheFirst(request, CACHE));
		return;
	}

	// Game artwork. `fetch-game-images.mjs` rewrites these files in place, so a
	// cached copy can go stale after an art refresh — an acceptable trade for
	// having artwork offline at all.
	if (url.pathname.startsWith('/images/games/')) {
		event.respondWith(cacheFirst(request, CACHE));
		return;
	}

	// SSR navigations, including the `__data.json` calls a soft navigation makes.
	if (request.mode === 'navigate' || isDataRequest) {
		event.respondWith(
			networkFirst(request, CACHE).catch(async () => {
				// A failed `__data.json` must NOT be answered with the offline HTML:
				// the client router expects JSON and would throw on it. Let it reject
				// so the router surfaces its own error.
				if (isDataRequest) return Response.error();
				return (await fromCache(new Request(OFFLINE_URL), CACHE)) ?? Response.error();
			})
		);
	}
});