/**
 * Verifies that every `mapUrl` and `guide.sourceUrl` in the game data still
 * resolves.
 *
 * The rule this enforces: **only save a `mapUrl` that returned HTTP 200.** It is
 * the one field in a game file that cannot be checked by reading the file, and a
 * dead map link is worse than an absent one — the player taps it and gets nothing.
 *
 * It also enforces the distinction the gamedata agent file insists on:
 *
 *   200            verified
 *   403            UNVERIFIABLE, not dead. `wiki.gg`, `fandom` and
 *                  `trueachievements.com` return 403 to every scripted request
 *                  because of Cloudflare, and work fine in a browser. Treat these
 *                  as "open it by hand", never as "delete it".
 *   404 / 410      dead. A real answer, and the only one that fails.
 *
 * `sourceUrl` coverage is reported rather than enforced: shipped games
 * deliberately have 0% `sourceUrl` coverage on trivial trophies, and inventing
 * links to fix a number is exactly what the agent file forbids.
 *
 * Usage:
 *   node scripts/agent/check-links.mjs                     # every game
 *   node scripts/agent/check-links.mjs --game 1245620
 *   node scripts/agent/check-links.mjs --field mapUrl
 *   node scripts/agent/check-links.mjs --url https://mapgenie.io/elden-ring
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/cli.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMES_DIR = join(ROOT, 'src/lib/data/games');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Cloudflare-protected hosts: 403 from a script says nothing about the browser. */
const CLOUDFLARE_HOSTS = /(trueachievements\.com|wiki\.gg|fandom\.com)/i;

const HELP = `
check-links.mjs — verify mapUrl and guide.sourceUrl reach a real page

  node scripts/agent/check-links.mjs [options]

  --game <appId>    Only this game. Repeatable via a comma list.
  --field <name>    mapUrl | sourceUrl | both (default)
  --url <url>       Check one URL instead of the game files
  --timeout <ms>    Per-request timeout. Default 15000

Exit code 1 when any link is DEAD (404/410/DNS). A 403 is reported as
unverifiable, not dead: those hosts block every scripted request.
`;

function parseArgs(argv) {
	const args = { field: 'both', games: [], timeout: 15000 };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => argv[++i];
		if (arg === '--game') args.games.push(...next().split(',').map((s) => s.trim()));
		else if (arg === '--field') args.field = next();
		else if (arg === '--url') args.url = next();
		else if (arg === '--timeout') args.timeout = parseInt(next(), 10);
		else if (arg === '--help' || arg === '-h') args.help = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

/** Follows redirects but keeps the final status — a redirect to a 404 is dead. */
async function check(url, timeout) {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
			redirect: 'follow',
			signal: AbortSignal.timeout(timeout)
		});
		const cloudflare = CLOUDFLARE_HOSTS.test(new URL(url).hostname);
		if (res.ok) return { url, status: res.status, verdict: 'ok' };
		if (res.status === 403) {
			return { url, status: 403, verdict: cloudflare ? 'blocked' : 'forbidden' };
		}
		if (res.status === 404 || res.status === 410) return { url, status: res.status, verdict: 'dead' };
		return { url, status: res.status, verdict: 'other' };
	} catch (e) {
		const reason = e.cause?.code ?? e.name;
		return { url, status: null, verdict: 'unreachable', reason };
	}
}

/** Concurrency stays low: these are third-party sites, not ours. */
async function checkAll(urls, timeout) {
	const results = [];
	const CONCURRENCY = 4;
	for (let i = 0; i < urls.length; i += CONCURRENCY) {
		results.push(...(await Promise.all(urls.slice(i, i + CONCURRENCY).map((u) => check(u, timeout)))));
	}
	return results;
}

const VERDICT_COLOUR = {
	ok: '\x1b[32m',
	blocked: '\x1b[33m',
	forbidden: '\x1b[33m',
	dead: '\x1b[31m',
	other: '\x1b[33m',
	unreachable: '\x1b[31m'
};
const colour = (verdict, text) => `${VERDICT_COLOUR[verdict] ?? ''}${text}\x1b[0m`;

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(HELP);
		return;
	}

	if (args.url) {
		const result = await check(args.url, args.timeout);
		console.log(`${colour(result.verdict, result.verdict.padEnd(10))} ${result.status ?? '-'}  ${result.url}`);
		if (result.reason) console.log(`            ${result.reason}`);
		if (result.verdict === 'dead' || result.verdict === 'unreachable') process.exitCode = 1;
		return;
	}

	const files = args.games.length
		? args.games.map((id) => `${id}.json`)
		: (await readdir(GAMES_DIR)).filter((f) => /^\d+\.json$/.test(f));
	if (!files.length) throw new Error('No game files found. Use --game <appId>.');

	/** @type {{game: string, field: string, where: string, url: string}[]} */
	const targets = [];
	let sourceCoverage = { withSource: 0, total: 0 };

	for (const file of files) {
		const data = JSON.parse(await readFile(join(GAMES_DIR, file), 'utf8'));
		if (args.field !== 'sourceUrl' && data.mapUrl) {
			targets.push({ game: data.name, field: 'mapUrl', where: 'game', url: data.mapUrl });
		}
		if (args.field !== 'mapUrl') {
			for (const a of data.achievements) {
				if (a.guide?.sourceUrl) {
					targets.push({ game: data.name, field: 'sourceUrl', where: a.name, url: a.guide.sourceUrl });
				}
			}
		}
		sourceCoverage.withSource += data.achievements.filter((a) => a.guide?.sourceUrl).length;
		sourceCoverage.total += data.achievements.length;
	}

	if (!targets.length) {
		console.log('No links to check.');
		console.log(
			`sourceUrl coverage: ${sourceCoverage.withSource}/${sourceCoverage.total} ` +
				'— a low number on trivial trophies is intended, not a defect. Never invent a link to raise it.'
		);
		return;
	}

	const results = await checkAll(targets.map((t) => t.url), args.timeout);
	const byUrl = new Map(results.map((r) => [r.url, r]));

	const tally = { ok: 0, blocked: 0, forbidden: 0, dead: 0, other: 0, unreachable: 0 };
	const failures = [];

	for (const t of targets) {
		const r = byUrl.get(t.url);
		tally[r.verdict]++;
		const where = t.field === 'mapUrl' ? `${t.game} (mapUrl)` : `${t.game} — ${t.where}`;
		if (r.verdict === 'dead' || r.verdict === 'unreachable') {
			failures.push(`${colour(r.verdict, r.verdict.toUpperCase())} ${r.status ?? r.reason}  ${where}\n              ${t.url}`);
		}
	}

	for (const failure of failures) console.log(failure);

	const neutral = targets.length - failures.length;
	console.log(`\nchecked ${targets.length} links — ${tally.ok} ok, ${tally.blocked} cloudflare-blocked, ${tally.forbidden} forbidden, ${tally.other} other, ${failures.length} dead`);
	if (tally.blocked) {
		console.log(
			'Blocked hosts (trueachievements / wiki.gg / fandom) refuse every scripted request.\n' +
				'That is unverifiable, NOT dead — open them in a browser before changing anything.'
		);
	}
	console.log(
		`sourceUrl coverage: ${sourceCoverage.withSource}/${sourceCoverage.total} ` +
			'(trivially-earned trophies having none is intended)'
	);
	if (failures.length) {
		console.log(`\n${neutral} links were fine. Remove or replace the ${failures.length} above.`);
		process.exitCode = 1;
	}
}

await run(main);