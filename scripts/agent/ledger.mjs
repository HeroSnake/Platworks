/**
 * The fetch ledger, as a CLI.
 *
 * Re-fetching a page you already read is the main cost sink in a multi-game run:
 * the same wiki index gets opened four times because nothing remembered the first
 * time. The ledger is the answer to "have I already opened this page?", and this
 * script enforces the discipline the prompt states rather than leaving it to
 * memory:
 *
 *   1. `check <url>` before every request. Exit 0 = already logged, read what it
 *      answered instead. Exit 1 = not fetched yet, so log it with `add` FIRST.
 *   2. `add` writes the entry with `status: "pending"` *before* the request, so a
 *      crashed run still shows the page was being opened.
 *   3. `resolve` closes it out with the status, the achievements it covered and
 *      what it answered.
 *
 * A dead end is still an entry: log the 403 and move on. `wiki.gg` and `fandom`
 * return 403 to scripted requests, and that gets recorded once rather than
 * re-attempted with a different spelling.
 *
 * Usage:
 *   node scripts/agent/ledger.mjs 1245620 check https://wiki.example/Achievements
 *   node scripts/agent/ledger.mjs 1245620 add https://wiki.example/Achievements
 *   node scripts/agent/ledger.mjs 1245620 resolve https://wiki.example/Achievements \
 *       --status 200 --covers FIND_3_SHARDS,KILL_BOSS_1 \
 *       --answered "All 42 names + missable table" --notes "has a Location column"
 *   node scripts/agent/ledger.mjs 1245620 list
 *   node scripts/agent/ledger.mjs 1245620 uncovered --all
 *   node scripts/agent/ledger.mjs 1245620 stats
 *
 * `--dir <path>` overrides the default `.tmp/game-data/{appId}/`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/cli.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const HELP = `
ledger.mjs — the fetch ledger for /generate-game-data

  node scripts/agent/ledger.mjs <appId> <command> [url] [options]

  check <url>            exit 0 if already logged, 1 if not. Run BEFORE fetching.
  add <url>              log the intent with status "pending". Run BEFORE fetching.
  resolve <url>          close the entry out after the request.
    --status <n|blocked>   HTTP status, or "blocked" for a known-403 host
    --covers <a,b,c>       every achievement the page served
    --answered <text>      what it actually answered
    --notes <text>         anything worth remembering (a Location column, …)
  list [--pending]       show every entry
  uncovered --all        achievements no entry claims to cover
  stats                  request count and coverage

  --dir <path>           Override .tmp/game-data/{appId}/
`;

function parseArgs(argv) {
	const args = { _: [], flags: {} };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith('--')) {
			const key = arg.slice(2);
			const next = argv[i + 1];
			if (next === undefined || next.startsWith('--')) args.flags[key] = true;
			else {
				args.flags[key] = next;
				i++;
			}
		} else {
			args._.push(arg);
		}
	}
	return args;
}

const ledgerPath = (dir) => join(dir, 'ledger.json');

/** Normalises a URL so the same page matches itself across spellings. */
function normalise(url) {
	try {
		const u = new URL(url);
		u.hash = '';
		// Steam treats /stats/x/ and /stats/x the same; a trailing slash must not
		// create a second ledger entry for a page already read.
		u.pathname = u.pathname.replace(/\/+$/, '') || '/';
		return u.toString();
	} catch {
		return url;
	}
}

async function readLedger(dir) {
	try {
		const raw = JSON.parse(await readFile(ledgerPath(dir), 'utf8'));
		return Array.isArray(raw) ? raw : (raw.entries ?? []);
	} catch {
		return [];
	}
}

async function writeLedger(dir, entries) {
	await mkdir(dir, { recursive: true });
	await writeFile(ledgerPath(dir), `${JSON.stringify(entries, null, '\t')}\n`, 'utf8');
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (!args._.length || args.flags.help) {
		console.log(HELP);
		return;
	}

	const [appId, command, url] = args._;
	const dir = args.flags.dir ?? join(ROOT, '.tmp/game-data', appId);
	const entries = await readLedger(dir);

	if (command === 'check') {
		if (!url) throw new Error('check needs a URL.');
		const hit = entries.find((e) => normalise(e.url) === normalise(url));
		if (!hit) {
			console.log(`not fetched: ${url}`);
			console.log(`log it before fetching:  node scripts/agent/ledger.mjs ${appId} add ${url}`);
			process.exitCode = 1;
			return;
		}
		if (hit.status === 'pending') {
			console.log(`PENDING — a previous run logged this but never closed it out: ${url}`);
			process.exitCode = 1;
			return;
		}
		console.log(`already fetched (${hit.status}): ${url}`);
		console.log(`  answered: ${hit.answered ?? '(not recorded)'}`);
		console.log(`  covers:   ${(hit.covers ?? []).join(', ') || '(none recorded)'}`);
		if (hit.notes) console.log(`  notes:    ${hit.notes}`);
		return;
	}

	if (command === 'add') {
		if (!url) throw new Error('add needs a URL.');
		if (entries.some((e) => normalise(e.url) === normalise(url))) {
			throw new Error(
				`${url} is already in the ledger. Do not fetch it again — read what it answered.`
			);
		}
		entries.push({ url, fetchedAt: new Date().toISOString(), status: 'pending', covers: [], answered: null, notes: null });
		await writeLedger(dir, entries);
		console.log(`logged (pending): ${url}`);
		return;
	}

	if (command === 'resolve') {
		if (!url) throw new Error('resolve needs a URL.');
		const entry = entries.find((e) => normalise(e.url) === normalise(url));
		if (!entry) throw new Error(`${url} is not in the ledger. Run \`add\` before fetching it.`);
		entry.status = args.flags.status ?? entry.status;
		entry.covers = args.flags.covers ? String(args.flags.covers).split(',').map((s) => s.trim()).filter(Boolean) : entry.covers;
		entry.answered = args.flags.answered ?? entry.answered;
		entry.notes = args.flags.notes ?? entry.notes;
		entry.resolvedAt = new Date().toISOString();
		await writeLedger(dir, entries);
		console.log(`resolved (${entry.status}): ${url} — covers ${entry.covers?.length ?? 0}`);
		return;
	}

	if (command === 'list') {
		if (!entries.length) {
			console.log('ledger is empty.');
			return;
		}
		for (const e of entries) {
			const marker = e.status === 'pending' ? '…' : String(e.status).padStart(3);
			console.log(
				`${marker}  ${(e.covers ?? []).length.toString().padStart(3)} covered  ${e.url}` +
					`\n       ${e.answered ?? '(not recorded)'}`
			);
		}
		return;
	}

	if (command === 'stats') {
		const covered = new Set(entries.flatMap((e) => e.covers ?? []));
		const pending = entries.filter((e) => e.status === 'pending').length;
		const blocked = entries.filter((e) => String(e.status) === 'blocked' || Number(e.status) === 403);
		console.log(`requests: ${entries.length}  achievements covered: ${covered.size}  pending: ${pending}  blocked: ${blocked.length}`);
		if (blocked.length) {
			console.log('\nBlocked sources — record once, then move on:');
			for (const e of blocked) console.log(`  ${e.status}  ${e.url}`);
		}
		if (pending) {
			console.log('\nPending entries — a run crashed before resolving these:');
			for (const e of entries.filter((x) => x.status === 'pending')) console.log(`  ${e.url}`);
		}
		return;
	}

	if (command === 'uncovered') {
		// Reads the triage output, which is what names the achievements to cover.
		const achievementsPath = join(dir, 'achievements.json');
		const covered = new Set(entries.flatMap((e) => e.covers ?? []));
		if (args.flags.all) {
			const list = JSON.parse(await readFile(achievementsPath, 'utf8')).achievements;
			const missing = list.filter((a) => !covered.has(a.name) && !covered.has(a.id));
			console.log(`${missing.length} of ${list.length} uncovered:`);
			for (const a of missing) console.log(`  ${a.name}`);
			return;
		}
		const wanted = args._.slice(3);
		for (const id of wanted) console.log(`${covered.has(id) ? 'covered  ' : 'UNCOVERED'} ${id}`);
		return;
	}

	throw new Error(`Unknown command "${command}". See --help.`);
}

await run(main);