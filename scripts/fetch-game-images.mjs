/**
 * Downloads game artwork into the repo so the app never calls Steam's CDN at runtime.
 *
 * Layout, keyed by appId:
 *   static/images/games/{appId}/header.jpg   460x215  library card
 *   static/images/games/{appId}/hero.jpg    1920x620 game page hero (not every game has one)
 *
 * Steam's page background is deliberately NOT mirrored. It renders behind a 90%
 * `bg-steam-dark` scrim, so roughly a tenth of it is visible, and the real files
 * run to 1.6 MB each — 17 MB of repo for something you cannot see. It was dropped
 * from the page rather than committed.
 *
 * Why this exists: `appdetails` intermittently 403s from Node, and the un-hashed
 * CDN guess the server used to fall back on is wrong for some apps (Steam serves
 * those from a content-hashed directory, e.g.
 * /apps/4126040/bf9b76d2.../header.jpg). The result was artwork that appeared and
 * disappeared between reloads. The only trustworthy URL is the one appdetails
 * returns, so it is resolved once here and committed with the game data.
 *
 * Usage:  node scripts/fetch-game-images.mjs [appId ...]
 *         (no args = every game file in src/lib/data/games/)
 *         --force  re-download even when the file already exists
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(ROOT, 'src/lib/data/games');
const OUT_ROOT = join(ROOT, 'static/images/games');

/** Public path a component can use. Matches what `api.ts` hands to the client. */
export const publicPath = (appId, file) => `/images/games/${appId}/${file}`;

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const STORE_API = 'https://store.steampowered.com/api';
const ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => /^\d+$/.test(a));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(p) {
	try {
		const s = await stat(p);
		return s.size > 0;
	} catch {
		return false;
	}
}

/** appdetails gives the authoritative, content-hashed artwork URLs. */
async function fetchDetails(appId) {
	const res = await fetch(`${STORE_API}/appdetails?appids=${appId}&l=english`, {
		headers: { 'User-Agent': UA, Accept: 'application/json' }
	});
	if (!res.ok) throw new Error(`appdetails HTTP ${res.status}`);
	const data = (await res.json())[String(appId)];
	if (!data?.success) throw new Error('appdetails reported failure');
	return data.data;
}

/**
 * Steam only publishes `library_hero.jpg` for some games — roughly one in a dozen
 * has none. Probed with a ranged GET so a large banner is not downloaded twice.
 */
async function probeHero(appId) {
	const url = `${ASSETS}/steam/apps/${appId}/library_hero.jpg`;
	try {
		const res = await fetch(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-1023' } });
		if (!res.ok && res.status !== 206) return null;
		await res.arrayBuffer();
		return url;
	} catch {
		return null;
	}
}

async function download(url, dest) {
	const res = await fetch(url, { headers: { 'User-Agent': UA } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (!buf.length) throw new Error('empty response');
	await mkdir(dirname(dest), { recursive: true });
	await writeFile(dest, buf);
	return buf.length;
}

const appIds = only.length
	? only
	: (await readdir(GAMES_DIR))
			.map((f) => /^(\d+)\.json$/.exec(f)?.[1])
			.filter(Boolean)
			.sort((a, b) => Number(a) - Number(b));

let bytes = 0;
let wrote = 0;
const problems = [];

for (const appId of appIds) {
	let name = appId;
	try {
		name = JSON.parse(await readFile(join(GAMES_DIR, `${appId}.json`), 'utf8')).name;
	} catch {
		/* name is cosmetic here */
	}

	const dir = join(OUT_ROOT, appId);
	const headerDest = join(dir, 'header.jpg');
	const heroDest = join(dir, 'hero.jpg');

	if (!force && (await exists(headerDest)) && (await exists(heroDest))) {
		console.log(`${appId} ${name}: already present, skipping`);
		continue;
	}

	let details;
	try {
		details = await fetchDetails(appId);
	} catch (e) {
		problems.push(`${appId} ${name}: ${e.message}`);
		continue;
	}
	await sleep(400); // be polite to Steam

	const jobs = [[details.header_image, headerDest]];
	if (!(await exists(heroDest)) || force) {
		const hero = await probeHero(appId);
		if (hero) jobs.push([hero, heroDest]);
	}

	const notes = [];
	for (const [url, dest] of jobs) {
		if (!url) {
			problems.push(`${appId} ${name}: no URL for ${dest.split('/').pop()}`);
			continue;
		}
		try {
			const size = await download(url, dest);
			bytes += size;
			wrote++;
			notes.push(`${dest.split('/').pop()} ${Math.round(size / 1024)}kB`);
		} catch (e) {
			problems.push(`${appId} ${name}: ${dest.split('/').pop()} ${e.message}`);
		}
	}

	console.log(`${appId} ${name}: ${notes.join(', ') || 'nothing new'}`);
}

console.log(`\nDone. ${wrote} files, ${Math.round(bytes / 1024 / 1024)} MB total -> static/images/games/`);
if (problems.length) {
	console.log('\nProblems:');
	for (const p of problems) console.log(`  - ${p}`);
	process.exitCode = 1;
}