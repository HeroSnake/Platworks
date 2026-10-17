/**
 * Fetches the Steam global achievement list for a game, once.
 *
 * Phase 2 of /generate-game-data: "fetch the game's community achievement list
 * once — the authoritative source for names and IDs — and parse it to
 * `achievements.json`". This is that scraper, kept in the repo instead of being
 * rewritten into `.tmp/game-data/{appId}/scripts/` on every run.
 *
 * The page itself is now a React SSR app; the parsing lives in
 * `lib/steam-achievements-page.mjs`, which documents the retired markup and the
 * `valve-ssr-data` payload that replaced it. Read that first — it explains why
 * this script no longer regexes `<h3>` and why `id` is now filled in.
 *
 * What the page gives, and what it does not:
 *
 *   name, description, iconUrl, unlock rate, `hidden`  — yes
 *   `id` (the Steamworks apiname)                      — yes, from the SSR
 *                                                        schema query. This used
 *                                                        to be a gap the public
 *                                                        page could not fill.
 *
 * Usage:
 *   node scripts/agent/steam-achievements.mjs 1245620
 *   node scripts/agent/steam-achievements.mjs 1245620 --name "ELDEN RING"
 *   node scripts/agent/steam-achievements.mjs 1245620 --force
 *   node scripts/agent/steam-achievements.mjs 1245620 --out .tmp/scratch/achievements.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/cli.mjs';
import { fetchAchievementPage } from './lib/steam-achievements-page.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const HELP = `
steam-achievements.mjs — fetch a game's Steam achievement list, once

  node scripts/agent/steam-achievements.mjs <appId> [options]

  --name <text>   Game name to record alongside the list
  --out <path>    Output file. Default: .tmp/game-data/{appId}/achievements.json
  --force         Re-fetch even when the output already exists
  --quiet         Only print the summary line
`;

function parseArgs(argv) {
	const args = { appId: null, name: null, out: null, force: false, quiet: false };
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => argv[++i];
		if (arg === '--name') args.name = next();
		else if (arg === '--out') args.out = next();
		else if (arg === '--force') args.force = true;
		else if (arg === '--quiet') args.quiet = true;
		else if (arg === '--help' || arg === '-h') args.help = true;
		else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
		else positional.push(arg);
	}
	if (!/^\d+$/.test(positional[0] ?? '') && !args.help) {
		throw new Error(`appId must be the numeric Steam app id, got "${positional[0] ?? ''}". See --help.`);
	}
	args.appId = positional[0];
	return args;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(HELP);
		return;
	}

	const out = args.out ?? join(ROOT, '.tmp/game-data', args.appId, 'achievements.json');

	// One fetch per run is the whole point: re-opening this page is the main cost
	// sink in a multi-game run, which is what the ledger exists to prevent.
	if (!args.force) {
		const existing = await readFile(out, 'utf8').catch(() => null);
		if (existing) {
			const data = JSON.parse(existing);
			console.log(`${args.appId}: already fetched — ${data.achievements.length} achievements in ${out}`);
			console.log('Pass --force to fetch again.');
			return;
		}
	}

	const { url, gameName, rows } = await fetchAchievementPage(args.appId);

	// A row without an apiname cannot be matched by sync or by the icon script, and
	// the old page produced those silently. Report rather than write them quietly.
	const missingIds = rows.filter((r) => !r.id).map((r) => r.name);

	const payload = {
		appId: Number(args.appId),
		name: args.name ?? null,
		source: url,
		fetchedAt: new Date().toISOString(),
		steamDisplayName: gameName,
		achievements: rows.map((r) => ({
			id: r.id,
			name: r.name,
			description: r.description,
			hidden: r.hidden,
			unlockRate: r.unlockRate,
			iconUrl: r.iconUrl
		}))
	};

	await mkdir(dirname(out), { recursive: true });
	await writeFile(out, `${JSON.stringify(payload, null, '\t')}\n`, 'utf8');

	if (!args.quiet) {
		const hidden = rows.filter((r) => r.hidden).length;
		const rarity = [...rows]
			.filter((r) => r.unlockRate !== null)
			.sort((a, b) => a.unlockRate - b.unlockRate)
			.slice(0, 5);
		console.log(`Wrote ${rows.length} achievements to ${out}`);
		console.log(`  hidden (Steam's own flag): ${hidden}`);
		console.log(`  rarest — these are the ones phase 4 should research first:`);
		for (const r of rarity) console.log(`    ${String(r.unlockRate).padStart(5)}%  ${r.name}`);
	}

	if (missingIds.length) {
		console.log(
			`\nWARNING: ${missingIds.length} row(s) carry no apiname, so \`id\` is null for them. ` +
				'Report this — do not invent one:\n' +
				missingIds.map((n) => `  ${n}`).join('\n')
		);
		process.exitCode = 1;
	}
}

await run(main);
