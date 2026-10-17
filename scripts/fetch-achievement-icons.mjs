/**
 * Scrapes official Steam achievement icons into src/lib/data/games/*.json.
 *
 * Source of truth: the game's community achievements page,
 *   https://steamcommunity.com/achievements/{appId}
 * which is the same page the trophy IDs and names came from. The icon comes from
 * the SSR payload's schema query, and rows are matched to our data by display
 * name.
 *
 * That page is now the React SSR app documented in
 * `agent/lib/steam-achievements-page.mjs` — the old `achieveImgHolder` markup is
 * gone, so this script parses the shared payload instead of regexing the HTML.
 *
 * The payload publishes both icons; we store the *achieved* (coloured) one,
 * because the app grayscales `iconUrl` itself for the locked look.
 *
 * Usage:  node scripts/fetch-achievement-icons.mjs [appId ...]
 *         (no args = every game file in src/lib/data/games/)
 *         --force  re-scrape games that already have icons
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAchievementPage } from './agent/lib/steam-achievements-page.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(ROOT, 'src/lib/data/games');

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => /^\d+$/.test(a));

/**
 * Steam lowercases, strips punctuation and collapses spaces for fuzzy matching.
 * The apostrophe class covers straight, curly and double quotes because Steam's
 * own pages are inconsistent: "Dead Man's Chest" locally vs "Dead Man’s Chest"
 * on the global list. Dropping the quote entirely (rather than turning it into a
 * space) is what makes both forms hash to the same key.
 */
const normalize = (s) =>
	s
		.toLowerCase()
		.replace(/["'‘’“”«»]/g, '')
		.replace(/[^a-z0-9 ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

/** Token-overlap score, used only as a last resort when names do not line up. */
function similarity(a, b) {
	if (a === b) return 1;
	const ta = new Set(a.split(' ').filter(Boolean));
	const tb = new Set(b.split(' ').filter(Boolean));
	if (!ta.size || !tb.size) return 0;
	let shared = 0;
	for (const t of ta) if (tb.has(t)) shared++;
	return shared / Math.max(ta.size, tb.size);
}

/** One record per achievement: { name, iconUrl }. */
async function fetchRows(appId) {
	const { rows } = await fetchAchievementPage(appId);
	const mapped = rows.filter((r) => r.name && r.iconUrl).map((r) => ({ name: r.name, iconUrl: r.iconUrl }));
	// A game with no achievements page returns no rows.
	if (!mapped.length) throw new Error('no achievement rows found (page may not exist)');
	return mapped;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const appIds = only.length
	? only
	: (await readdir(GAMES_DIR))
			.map((f) => /^(\d+)\.json$/.exec(f)?.[1])
			.filter(Boolean);

let matchedTotal = 0;
let missingTotal = 0;
const problems = [];

for (const appId of appIds) {
	const file = join(GAMES_DIR, `${appId}.json`);
	let data;
	try {
		data = JSON.parse(await readFile(file, 'utf8'));
	} catch (e) {
		problems.push(`${appId}: cannot read file (${e.message})`);
		continue;
	}

	const needsWork =
		force || data.achievements.some((a) => !a.iconUrl);
	if (!needsWork) {
		console.log(`${appId} ${data.name}: already complete, skipping`);
		continue;
	}

	let rows;
	try {
		rows = await fetchRows(appId);
	} catch (e) {
		problems.push(`${appId} ${data.name}: scrape failed (${e.message})`);
		continue;
	}
	await sleep(600); // be polite to Steam

	// Index rows by exact name, then by normalized name.
	const byExact = new Map(rows.map((r) => [r.name, r.iconUrl]));
	const byNorm = new Map();
	for (const r of rows) {
		const k = normalize(r.name);
		if (!byNorm.has(k)) byNorm.set(k, r.iconUrl);
	}

	const missing = [];
	let matched = 0;
	for (const a of data.achievements) {
		const hit =
			byExact.get(a.name) ??
			byNorm.get(normalize(a.name)) ??
			// Last resort: closest name by token overlap, above a strict threshold.
			(() => {
				const na = normalize(a.name);
				let best = null;
				let bestScore = 0.6;
				for (const r of rows) {
					const s = similarity(na, normalize(r.name));
					if (s > bestScore) {
						bestScore = s;
						best = r.iconUrl;
					}
				}
				return best;
			})();

		if (hit) {
			a.iconUrl = hit;
			matched++;
		} else {
			delete a.iconUrl;
			missing.push(a.name);
		}
	}

	matchedTotal += matched;
	missingTotal += missing.length;

	// Reorder keys so iconUrl sits next to description on every achievement,
	// matching the field order in types/game.ts.
	data.achievements = data.achievements.map((a) => ({
		id: a.id,
		name: a.name,
		description: a.description,
		...(a.iconUrl ? { iconUrl: a.iconUrl } : {}),
			types: a.types,
		difficulty: a.difficulty,
		guide: a.guide
	}));

	await writeFile(file, `${JSON.stringify(data, null, '\t')}\n`, 'utf8');

	console.log(
		`${appId} ${data.name}: ${matched}/${data.achievements.length} icons` +
			(missing.length ? ` | unmatched: ${missing.join(', ')}` : '')
	);
}

console.log(`\nDone. ${matchedTotal} icons written, ${missingTotal} achievements left without one.`);
if (problems.length) {
	console.log('\nProblems:');
	for (const p of problems) console.log(`  - ${p}`);
	process.exitCode = 1;
}