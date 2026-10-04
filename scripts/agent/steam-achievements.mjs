/**
 * Fetches the Steam global achievement list for a game, once.
 *
 * Phase 2 of /generate-game-data: "fetch `steamcommunity.com/stats/{appId}/achievements`
 * once — the authoritative source for names and IDs — and parse it to
 * `achievements.json`". This is that scraper, kept in the repo instead of being
 * rewritten into `.tmp/game-data/{appId}/scripts/` on every run.
 *
 * What the page gives, and what it does not:
 *
 *   name, description, iconUrl, unlock rate  — yes
 *   `id` (the API name)                     — NO. The page has no apiname field
 *                                              and no data-achievementid attribute.
 *   `hidden`                                — inferred. Steam blanks the <h5> of a
 *                                              secret trophy, so an empty
 *                                              description is the signal.
 *
 * The `id` gap is real and the script says so rather than inventing one: the API
 * name only comes from the Steamworks partner site or GetSchemaForGame, both of
 * which need credentials. Every achievement is written with `"id": null` and the
 * count is reported, so the gap is impossible to miss when writing the game JSON.
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

const decodeEntities = (s) =>
	s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&nbsp;/g, ' ');

/**
 * One record per `achieveRow`. The regex anchors on the image inside
 * `achieveImgHolder` so an unrelated <h3> on the page cannot produce a row, and
 * spans to the end of the row block so the <h5> and the unlock rate land in the
 * same match.
 */
function parseRows(html) {
	const rows = [];
	const rowRe = /<div class="achieveImgHolder">\s*<img src="([^"]+)"[^>]*>([\s\S]*?)<div style="clear: both;"><\/div>/g;

	for (const m of html.matchAll(rowRe)) {
		const iconUrl = decodeEntities(m[1]);
		const block = m[2];

		const name = decodeEntities(/<h3>([\s\S]*?)<\/h3>/.exec(block)?.[1]?.replace(/<[^>]+>/g, '') ?? '').trim();
		if (!name) continue;

		const rawDescription = decodeEntities(/<h5>([\s\S]*?)<\/h5>/.exec(block)?.[1]?.replace(/<[^>]+>/g, '') ?? '').trim();
		const percent = /achievePercent">\s*([\d.]+)%/.exec(block)?.[1];

		rows.push({
			id: null,
			name,
			// Steam blanks the description of a secret trophy. That is the only
			// signal the public page gives, and it is why phase 2 says to read the
			// flag here rather than guessing it from the name.
			description: rawDescription,
			hidden: rawDescription === '',
			unlockRate: percent === undefined ? null : Number(percent),
			iconUrl
		});
	}
	return rows;
}

/** Reads the page's own achievement count, which catches a truncated fetch. */
function declaredTotal(html) {
	return Number(/Total achievements:[\s\S]*?<span class="wt">(\d+)<\/span>/.exec(html)?.[1] ?? NaN);
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

	const url = `https://steamcommunity.com/stats/${args.appId}/achievements`;
	const res = await fetch(url, {
		headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
		redirect: 'follow'
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);

	const html = await res.text();
	const rows = parseRows(html);
	if (!rows.length) {
		throw new Error(
			`No achievement rows on ${url}.\n` +
				'The game may have no achievements, or the app id may be wrong. Check the store page first.'
		);
	}

	const total = declaredTotal(html);
	// A short row list means a truncated page, not a small game. Writing it
	// silently would produce a game JSON that is permanently one achievement short.
	if (Number.isFinite(total) && total !== rows.length) {
		throw new Error(`Page declares ${total} achievements but ${rows.length} rows parsed — refusing to write a partial list.`);
	}

	const payload = {
		appId: Number(args.appId),
		name: args.name ?? null,
		source: url,
		fetchedAt: new Date().toISOString(),
		steamDisplayName: /<title>Steam Community :: ([^:]+):: Achievements/.exec(html)?.[1]?.trim() ?? null,
		achievements: rows
	};

	await mkdir(dirname(out), { recursive: true });
	await writeFile(out, `${JSON.stringify(payload, null, '\t')}\n`, 'utf8');

	if (!args.quiet) {
		const hidden = rows.filter((r) => r.hidden).length;
		const rarity = [...rows].sort((a, b) => (a.unlockRate ?? 101) - (b.unlockRate ?? 101)).slice(0, 5);
		console.log(`Wrote ${rows.length} achievements to ${out}`);
		console.log(`  hidden (empty description on Steam): ${hidden}`);
		console.log(`  rarest — these are the ones phase 4 should research first:`);
		for (const r of rarity) console.log(`    ${String(r.unlockRate ?? '?').padStart(5)}%  ${r.name}`);
	}

	console.log(
		`\nNOTE: every \`id\` is null. The public page carries no API name — take each one from the\n` +
			`Steamworks partner site or GetSchemaForGame. \`name\` is the join key for\n` +
			`scripts/fetch-achievement-icons.mjs, so it must stay exactly as Steam spells it.`
	);
}

await run(main);