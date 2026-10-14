/**
 * Fills the `id` gap in `.tmp/game-data/{appId}/achievements.json` when
 * `steam-schema.mjs` cannot.
 *
 * `ISteamUserStats/GetSchemaForGame` now returns 400 `Required parameter 'key'
 * is missing` for a growing set of apps (see [.agents/steam.md](../../.agents/steam.md) §3),
 * so the apinames are taken instead from the keyless
 * `ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid={appId}`.
 *
 * The two lists do NOT share a field: the percentages endpoint carries the API
 * name (`Game_LetsGetStarted`) and the community list carries the display name
 * (`Let's Get Started`). They are joined on a **normalised suffix** — strip
 * everything that is not a letter or digit, and the display name must be a
 * suffix of the API name. That resolves `Game_AFewMoreHoses` → `A Few More Hoses`
 * and `Habitat_SharedAccommodation` → `Shared Accommodation`.
 *
 * A positional zip (both lists are percent-descending) is **not** safe: the
 * community page floors every rate at `0.1%` while the API reports `0.0%`, so a
 * late game can have fifteen rows tied at `0.1` whose order differs between the
 * two endpoints. Do not zip by index.
 *
 * Rows the suffix join cannot resolve — a codename (`Zoo_TakeToTheSkies` for
 * "Birds of a Feather") or a spelling drift (`Habitat_Metamorphise` for
 * "Metamorphose") — are **reported, never guessed**. Resolve them with a
 * repeatable `--assign "<apiName>=<display name>"`.
 *
 * Usage:
 *   node scripts/agent/steam-ids.mjs 3219030                      # report only
 *   node scripts/agent/steam-ids.mjs 3219030 --merge              # fill achievements.json
 *   node scripts/agent/steam-ids.mjs 3219030 --merge \
 *     --assign "Zoo_TakeToTheSkies=Birds of a Feather"
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/cli.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HELP = `
steam-ids.mjs — fill the id gap from the keyless global-percentage endpoint

  node scripts/agent/steam-ids.mjs <appId> [options]

  --merge                 Write the ids into .tmp/game-data/{appId}/achievements.json
  --assign "<api>=<name>" Resolve a row the suffix join cannot (repeatable)
  --quiet                 Only print the summary line
`;

function parseArgs(argv) {
	const args = { appId: null, merge: false, quiet: false, assign: [], help: false };
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--merge') args.merge = true;
		else if (arg === '--quiet') args.quiet = true;
		else if (arg === '--assign') args.assign.push(argv[++i]);
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

/** Letters and digits only — the display name must be a suffix of the API name. */
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function fetchApinames(appId) {
	const url = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`;
	const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
	const body = await res.json();
	const list = body?.achievementpercentages?.achievements;
	if (!Array.isArray(list) || !list.length) {
		throw new Error(`No achievements in the percentage list for ${appId}.`);
	}
	return list.map((a) => ({ api: a.name, percent: Number(a.percent) }));
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(HELP);
		return;
	}

	const listPath = join(ROOT, '.tmp/game-data', args.appId, 'achievements.json');
	const list = JSON.parse(await readFile(listPath, 'utf8'));
	const apinames = await fetchApinames(args.appId);

	// Explicit assignments win and are removed from the pool first.
	const forced = new Map();
	for (const pair of args.assign) {
		const [api, name] = pair.split('=');
		if (!api || !name) throw new Error(`--assign must be "<api>=<display name>", got "${pair}"`);
		forced.set(api, name.trim());
	}

	const usedApi = new Set();
	const usedName = new Set();
	const resolved = new Map();

	for (const [api, name] of forced) {
		if (!apinames.some((a) => a.api === api)) throw new Error(`--assign api not in the list: ${api}`);
		if (!list.achievements.some((a) => a.name === name)) throw new Error(`--assign name not in the list: ${name}`);
		resolved.set(name, api);
		usedApi.add(api);
		usedName.add(name);
	}

	for (const row of list.achievements) {
		if (usedName.has(row.name)) continue;
		const key = squash(row.name);
		const hits = apinames.filter((a) => !usedApi.has(a.api) && squash(a.api).endsWith(key));
		if (hits.length === 1) {
			resolved.set(row.name, hits[0].api);
			usedApi.add(hits[0].api);
			usedName.add(row.name);
		}
	}

	const unmatchedNames = list.achievements.filter((a) => !resolved.has(a.name)).map((a) => a.name);
	const unmatchedApis = apinames.filter((a) => !usedApi.has(a.api)).map((a) => a.api);

	if (args.merge) {
		for (const a of list.achievements) a.id = resolved.get(a.name) ?? a.id;
		await writeFile(listPath, `${JSON.stringify(list, null, '\t')}\n`, 'utf8');
	}

	console.log(
		`${args.appId}: ${resolved.size}/${list.achievements.length} ids resolved` +
			(args.merge ? ' and written' : ' (dry run — pass --merge to write)')
	);
	if (unmatchedNames.length || unmatchedApis.length) {
		console.log(`\nUnresolved — pair them with --assign "<api>=<display name>", never guess:`);
		for (const n of unmatchedNames) console.log(`  name: ${n}`);
		for (const a of unmatchedApis) console.log(`  api:  ${a}`);
		process.exitCode = 1;
	}
}

await run(main);
