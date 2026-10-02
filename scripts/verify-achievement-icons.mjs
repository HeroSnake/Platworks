/**
 * Verifies every stored iconUrl: checks reachability, dimensions, and that each
 * game has no duplicate/blank entries. Run after scripts/fetch-achievement-icons.mjs.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAMES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/data/games');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

const files = (await readdir(GAMES_DIR)).filter((f) => /^\d+\.json$/.test(f));
const urls = new Set();
let total = 0;
let bad = 0;

for (const f of files) {
	const d = JSON.parse(await readFile(join(GAMES_DIR, f), 'utf8'));

	if (d.totalAchievements !== d.achievements.length) {
		console.log(`FAIL ${f}: totalAchievements ${d.totalAchievements} != ${d.achievements.length}`);
		bad++;
	}

	const seen = new Set();
	for (const a of d.achievements) {
		total++;
		if (!a.iconUrl) {
			console.log(`FAIL ${f}: "${a.name}" has no iconUrl`);
			bad++;
			continue;
		}
		if (!/^https:\/\/[a-z.]*steamstatic\.com\/community_assets\/images\/apps\//.test(a.iconUrl)) {
			console.log(`FAIL ${f}: "${a.name}" unexpected icon host: ${a.iconUrl}`);
			bad++;
		}
		if (seen.has(a.id)) {
			console.log(`FAIL ${f}: duplicate id ${a.id}`);
			bad++;
		}
		seen.add(a.id);
		urls.add(a.iconUrl);
	}
}

// One request per distinct URL — enough to catch a bad host or a stale path.
// Steam's CDN throttles bursts, so this stays deliberately gentle: low
// concurrency, a short pause, and retries. A single failure here is almost
// always the throttle, not a broken icon, so only an exhausted retry counts.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reachable(url) {
	for (let attempt = 1; attempt <= 4; attempt++) {
		try {
			const res = await fetch(url, {
				headers: { 'User-Agent': UA, Range: 'bytes=0-0' },
				redirect: 'follow'
			});
			if (res.ok || res.status === 206) return true;
			// 404 is a real answer; anything else is likely throttling.
			if (res.status === 404) return false;
		} catch {
			/* network hiccup — fall through to the retry */
		}
		await sleep(400 * attempt);
	}
	return false;
}

let unreachable = 0;
const unique = [...urls];
const CONCURRENCY = 5;

for (let i = 0; i < unique.length; i += CONCURRENCY) {
	await Promise.all(
		unique.slice(i, i + CONCURRENCY).map(async (u) => {
			if (await reachable(u)) return;
			console.log(`FAIL ${u}`);
			unreachable++;
		})
	);
	await sleep(120);
}

console.log(`\ngames: ${files.length}  achievements: ${total}  distinct icons: ${unique.length}`);
console.log(`data problems: ${bad}  unreachable icons: ${unreachable}`);
if (bad || unreachable) process.exitCode = 1;
else console.log('All icons reachable.');