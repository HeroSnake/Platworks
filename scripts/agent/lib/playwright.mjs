/**
 * Resolves Playwright without a hardcoded npx-cache hash, then launches a browser.
 *
 * `playwright` is NOT a dependency of this project (see dev.md §7),
 * so `import { chromium } from 'playwright'` fails. It is installed in some npx
 * cache directory whose name is a content hash and changes whenever the npx cache
 * is pruned — which is why agent scripts must never hardcode a path like
 * `/home/florent/.npm/_npx/e41f203b7505f1fb/...`.
 *
 * Resolution order:
 *   1. $PLAYWRIGHT_MODULE — an explicit path, for a non-default install.
 *   2. A local node_modules resolution (playwright installed as a dependency).
 *   3. Every `<npm cache>/_npx/<hash>/node_modules/playwright`, newest mtime first.
 *
 * `npm_config_cache` is honoured so a project-local or overridden npm cache is
 * searched alongside the default one.
 */
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENTRY = 'index.mjs';

/** Every npx cache root we should look in, most specific first. */
function cacheRoots() {
	const roots = [];
	if (process.env.npm_config_cache) roots.push(process.env.npm_config_cache);
	if (process.env.NPM_CONFIG_CACHE) roots.push(process.env.NPM_CONFIG_CACHE);
	roots.push(join(homedir(), '.npm'), join(homedir(), '.npm-cache'));
	return [...new Set(roots)];
}

/** All `playwright` entry points inside every npx cache dir, newest first. */
async function candidatesInNpxCache() {
	const found = [];
	for (const root of cacheRoots()) {
		const npxDir = join(root, '_npx');
		let entries;
		try {
			entries = await readdir(npxDir);
		} catch {
			continue; // no cache here
		}
		for (const entry of entries) {
			const modulePath = join(npxDir, entry, 'node_modules', 'playwright', ENTRY);
			try {
				const info = await stat(modulePath);
				found.push({ modulePath, mtime: info.mtimeMs });
			} catch {
				/* not a playwright install */
			}
		}
	}
	return found.sort((a, b) => b.mtime - a.mtime);
}

/** Absolute path of the Playwright module to import, or null. */
export async function resolvePlaywright() {
	const explicit = process.env.PLAYWRIGHT_MODULE;
	if (explicit) return explicit;

	try {
		const local = join(process.cwd(), 'node_modules', 'playwright', ENTRY);
		await stat(local);
		return local;
	} catch {
		/* not installed locally — expected in this repo */
	}

	const candidates = await candidatesInNpxCache();
	return candidates[0]?.modulePath ?? null;
}

/**
 * Imports `playwright` from wherever it happens to live.
 * Throws with the one command that fixes it, never a bare module-not-found.
 */
export async function loadPlaywright() {
	const modulePath = await resolvePlaywright();
	if (!modulePath) {
		throw new Error(
			'Playwright not found. Install it with:\n' +
				'  npx -y playwright@latest install --with-deps chromium\n' +
				'That fetches both the package and the browser binary.\n' +
				'Or set $PLAYWRIGHT_MODULE to an existing playwright/index.mjs.'
		);
	}
	return import(pathToFileURL(modulePath).href);
}

/**
 * Launches headless Chromium. `--no-sandbox` is required because the sandboxed
 * build cannot create user namespaces inside WSL.
 */
export async function launchBrowser(options = {}) {
	const { chromium } = await loadPlaywright();
	return chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], ...options });
}

/** The viewport widths every UI check in this repo is required to cover. */
export const WIDTHS = [390, 768, 1440, 2560];

/**
 * The same four, named. Mockup chrome and audit reports use the labels; a report
 * that says "2560" tells a reader nothing, one that says "ultrawide" does.
 */
export const FRAME_LABELS = { 390: 'phone', 768: 'tablet', 1440: 'desktop', 2560: 'ultrawide' };

/** Page height per width. Tall enough that a filter row is never below the fold. */
export const HEIGHT = 900;