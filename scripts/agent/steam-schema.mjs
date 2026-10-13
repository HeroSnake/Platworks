/**
 * Fetches a game's Steam achievement schema, keyless, and fills the `id` gap.
 *
 * Phase 2's `steam-achievements.mjs` reads the public community page, which has no
 * API-name field: it writes every achievement as `"id": null` and says so. The
 * Steamworks Web API's `ISteamUserStats/GetSchemaForGame` is the no-key source for
 * exactly that field — per achievement it returns `name` (the apiname our `id`
 * needs), `displayName`, `description`, the hidden flag and the icon.
 *
 * The two lists are joined on the **display name**, the only field they share. A
 * name that matches nothing is reported, never guessed at: assigning a neighbouring
 * row's apiname would look right and silently desync achievement sync and icons.
 *
 * The endpoint is keyless for the default schema. Adding an `l=` language parameter
 * is what makes it demand an API key ("Required parameter 'key' is missing"), so do
 * not add one.
 *
 * Usage:
 *   node scripts/agent/steam-schema.mjs 381210           # write .tmp/game-data/{appId}/schema.json
 *   node scripts/agent/steam-schema.mjs 381210 --merge   # also fill ids in achievements.json
 *   node scripts/agent/steam-schema.mjs 381210 --out .tmp/scratch/schema.json --force
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/cli.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HELP = `
steam-schema.mjs — fetch a game's Steam achievement schema (apinames), once

  node scripts/agent/steam-schema.mjs <appId> [options]

  --out <path>   Where to write the schema. Default: .tmp/game-data/{appId}/schema.json
  --merge        Fill each null \`id\` in .tmp/game-data/{appId}/achievements.json
  --force        Re-fetch even when the schema file already exists
  --quiet        Only print the summary line
`;

function parseArgs(argv) {
	const args = { appId: null, out: null, merge: false, force: false, quiet: false, help: false };
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => argv[++i];
		if (arg === '--out') args.out = next();
		else if (arg === '--merge') args.merge = true;
		else if (arg === '--force') args.force = true;
		else if (arg === '--quiet') args.quiet = true;
		else if (arg === '--help' || arg === '-h') args.help = true;
		else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
		else positional.push(arg);
	}
	if (!args.help && !/^\d+$/.test(positional[0] ?? '')) {
		throw new Error(`appId must be the numeric Steam app id, got "${positional[0] ?? ''}". See --help.`);
	}
	args.appId = positional[0];
	return args;
}

/**
 * Steam is inconsistent about quotes — "Dead Man's Chest" in one place vs
 * "Dead Man’s Chest" on a Steam page — so the join drops the whole quote class
 * rather than turning it into a space. Same rule as fetch-achievement-icons.mjs.
 */
const normalize = (s) =>
	s
		.toLowerCase()
		.replace(/["'‘’“”«»]/g, '')
		.replace(/[^a-z0-9 ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

async function fetchSchema(appId) {
	const url = new URL('https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/');
	url.searchParams.set('appid', appId);
	const res = await fetch(url, {
		headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
		redirect: 'follow'
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
	const body = await res.json();
	const list = body?.game?.availableGameStats?.achievements;
	if (!Array.isArray(list) || !list.length) {
		throw new Error(
			`No achievements in the schema for ${appId}.\n` +
				'Check the app id — or the game may genuinely have none.'
		);
	}
	return list.map((a) => ({
		id: a.name,
		name: a.displayName ?? '',
		description: a.description ?? '',
		hidden: a.hidden === 1 || a.hidden === true,
		icon: a.icon ?? null
	}));
}

/** Joins the schema to the phase-2 list on display name and fills the null ids. */
async function mergeIds(dir, schema) {
	const listPath = join(dir, 'achievements.json');
	const list = JSON.parse(await readFile(listPath, 'utf8'));

	const byExact = new Map(schema.map((s) => [s.name, s.id]));
	const byNorm = new Map();
	for (const s of schema) {
		const k = normalize(s.name);
		if (!byNorm.has(k)) byNorm.set(k, s.id);
	}

	const usedIds = new Set();
	const missing = [];
	for (const a of list.achievements) {
		const hit = byExact.get(a.name) ?? byNorm.get(normalize(a.name));
		if (hit) {
			a.id = hit;
			usedIds.add(hit);
		} else {
			missing.push(a.name);
		}
	}

	const extra = schema.filter((s) => !usedIds.has(s.id)).map((s) => s.name);

	await writeFile(listPath, `${JSON.stringify(list, null, '\t')}\n`, 'utf8');

	const filled = list.achievements.filter((a) => a.id).length;
	console.log(`Merged ids: ${filled}/${list.achievements.length} achievements now have an id.`);
	if (missing.length) {
		console.log(
			`\nNo schema row matches ${missing.length} listed name(s) — fix the spelling, never guess an id:`
		);
		for (const n of missing) console.log(`  ${n}`);
	}
	if (extra.length) {
		console.log(`\nIn the schema but not in the list (${extra.length}): ${extra.join(', ')}`);
	}
	if (missing.length) process.exitCode = 1;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(HELP);
		return;
	}

	const dir = join(ROOT, '.tmp/game-data', args.appId);
	const out = args.out ?? join(dir, 'schema.json');

	if (!args.force) {
		const existing = await readFile(out, 'utf8').catch(() => null);
		if (existing) {
			const data = JSON.parse(existing);
			console.log(`${args.appId}: already fetched — ${data.achievements.length} achievements in ${out}`);
			console.log('Pass --force to fetch again.');
			return;
		}
	}

	const schema = await fetchSchema(args.appId);
	await mkdir(dirname(out), { recursive: true });
	await writeFile(
		out,
		`${JSON.stringify(
			{
				appId: Number(args.appId),
				source: 'ISteamUserStats/GetSchemaForGame/v2',
				fetchedAt: new Date().toISOString(),
				achievements: schema
			},
			null,
			'\t'
		)}\n`,
		'utf8'
	);
	if (!args.quiet) console.log(`Wrote ${schema.length} schema achievements to ${out}`);

	if (args.merge) await mergeIds(dir, schema);
}

await run(main);
