/**
 * Scaffolds `.tmp/ui/{slug}/` for phase 3 of /ui-project.
 *
 * The mockup gate has three rules that are tedious to satisfy by hand every
 * single run and easy to get subtly wrong:
 *
 *   - real palette values, copied out of `src/app.css` (a mockup in invented
 *     colours reviews a design the app will not ship)
 *   - real fonts, the same Google Fonts link as `src/app.html`
 *   - real data, actual game and achievement names from `src/lib/data/games/`
 *
 * This writes a starter that already has all three, plus the notes.md skeleton
 * the gate requires and a width toggle so one file demonstrates both
 * breakpoints when the user double-clicks it. What it does NOT do is design
 * anything: the layout is a blank frame, because the propositions are the
 * agent's judgement, not a template's.
 *
 * Usage:
 *   node scripts/agent/new-mockup.mjs library-heatmap
 *   node scripts/agent/new-mockup.mjs game-hero-rework --game 1245620 --theme matrix
 *   node scripts/agent/new-mockup.mjs library-heatmap --list-games
 *
 * Options:
 *   --game <appId>   Game to take real data from. Default: the largest in the dir.
 *   --theme <id>     Palette to seed. Default: ember. One of the six in app.css.
 *   --variants <a,b> Variant stems to create. Default: a-inline
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './lib/cli.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_CSS = join(ROOT, 'src/app.css');
const APP_HTML = join(ROOT, 'src/app.html');
const GAMES_DIR = join(ROOT, 'src/lib/data/games');

function parseArgs(argv) {
	const args = { theme: 'ember', game: null, variants: ['a-inline'] };
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => argv[++i];
		if (arg === '--game') args.game = next();
		else if (arg === '--theme') args.theme = next();
		else if (arg === '--variants') args.variants = next().split(',').map((v) => v.trim()).filter(Boolean);
		else if (arg === '--list-games') args.listGames = true;
		else if (arg === '--help' || arg === '-h') args.help = true;
		else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
		else positional.push(arg);
	}
	args.slug = positional[0];
	return args;
}

const HELP = `
new-mockup.mjs — create .tmp/ui/{slug}/ ready for mockups

  node scripts/agent/new-mockup.mjs <slug> [--game <appId>] [--theme <id>] [--variants a,b]

  --game <appId>   Real game data to seed. Default: the largest achievement count.
  --theme <id>     Palette from src/app.css. Default: ember
  --variants <a,b> Variant stems. Default: a-inline
  --list-games     Print the available games and exit
`;

/**
 * Pulls the `--pw-*` palettes out of app.css, keyed by theme id.
 *
 * The file is not uniform: `:root` and `:root[data-theme='ember']` share one
 * block, every other palette has its own, and the display-face overrides live
 * in trailing blocks of their own. Matching every `:root…{ }` block and reading
 * the id out of the selector keeps this correct when a palette is added, renamed
 * or restructured — which is exactly when a hardcoded copy goes stale.
 */
function extractPalettes(css) {
	const found = {};
	// The body of a `:root` block holds no nested braces, so a non-greedy match
	// up to the first `}` is the whole declaration list.
	for (const m of css.matchAll(/:root([^{]*)\{([^}]*)\}/g)) {
		const selector = m[1];
		// The theme id is the first data-theme in the selector; a bare `:root` is
		// the base that every palette inherits from.
		const id = /data-theme=['"](\w+)['"]/.exec(selector)?.[1] ?? 'default';
		for (const decl of m[2].matchAll(/(--pw-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
			found[id] = { ...(found[id] ?? {}), [decl[1]]: decl[2].trim() };
		}
	}

	const { default: base, ...palettes } = found;
	// A palette that only overrides the display face still needs the base ramp.
	return Object.fromEntries(
		Object.entries(palettes).map(([id, tokens]) => [id, { ...base, ...tokens }])
	);
}

/** The Google Fonts <link> from app.html, so the mockup loads the same faces. */
function extractFontLink(html) {
	const link = /<link\s+href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"[\s\S]*?rel="stylesheet"/.exec(html);
	return link?.[1] ?? null;
}

/** Games sorted by achievement count, largest first. */
async function listGames() {
	const files = (await readdir(GAMES_DIR)).filter((f) => /^\d+\.json$/.test(f));
	const games = [];
	for (const f of files) {
		const data = JSON.parse(await readFile(join(GAMES_DIR, f), 'utf8'));
		games.push({ appId: data.appId, name: data.name, count: data.achievements.length });
	}
	return games.sort((a, b) => b.count - a.count);
}

function starterHtml({ variant, themeId, palette, fontHref, game }) {
	const tokens = Object.entries(palette)
		.map(([k, v]) => `\t\t\t\t${k}: ${v};`)
		.join('\n');

	const sample = game.achievements.slice(0, 6).map((a) => ({
		name: a.name,
		description: a.description,
		types: a.types,
		difficulty: a.difficulty
	}));

	return `<!doctype html>
<!--
	Variant ${variant} — ${game.name} (${game.totalAchievements} achievements)

	Self-contained on purpose: inline styles, real palette, real fonts, real data.
	It has to survive being deleted and open by double-click with nothing running.

	Replace the frame below with the proposition. Keep:
	  - the toggle, so both breakpoints are in this one file
	  - --pw-* tokens, so the design is the app's
	  - at least one real state (empty / loading / error / locked / unlocked)
	  - a caption at the bottom: what it borrows, what it costs, what it breaks
	Then:  node scripts/agent/shot.mjs .tmp/ui/${'${SLUG}'}
-->
<html lang="en" data-theme="${themeId}">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${variant} — ${game.name}</title>
${fontHref ? `\t\t<link href="${fontHref}" rel="stylesheet" />\n` : ''}		<style>
			:root {
${tokens}
				--tap: 40px; /* the app's floor; h-9 (36px) always fails */
			}
			* { box-sizing: border-box; }
			body {
				margin: 0;
				background: var(--pw-bg);
				color: var(--pw-text);
				font-family: Inter, system-ui, sans-serif;
				-webkit-font-smoothing: antialiased;
			}
			h1, h2, .display { font-family: var(--pw-font-display); }
			button { font: inherit; }

			/* Width toggle: proves both breakpoints live in this one file.
						   Its buttons clear --tap too: shot.mjs runs the same 40px floor
						   over a mockup as over the app, and demo chrome that fails the
						   check teaches the wrong habit. */
						.toggle {
							position: fixed; top: 8px; right: 8px; z-index: 10;
							display: flex; gap: 4px; padding: 4px;
							background: var(--pw-surface-2); border: 1px solid var(--pw-border);
							border-radius: 8px;
						}
						.toggle button {
							min-height: var(--tap); padding: 0 14px;
							background: transparent; color: var(--pw-dim);
							border: 0; border-radius: 6px; cursor: pointer;
						}
			.toggle button[aria-pressed='true'] { background: var(--pw-accent); color: var(--pw-accent-ink); }

			.frame { margin: 0 auto; border-left: 1px solid var(--pw-border); border-right: 1px solid var(--pw-border); }
			body[data-frame='390'] .frame { max-width: 390px; }
			body[data-frame='1440'] .frame { max-width: 1440px; }

			.caption {
				max-width: 60ch; margin: 32px auto; padding: 16px 20px;
				background: var(--pw-surface); border: 1px solid var(--pw-border);
				border-radius: 10px; color: var(--pw-dim); font-size: 14px; line-height: 1.6;
			}
			.caption strong { color: var(--pw-text); }
		</style>
	</head>
	<body data-frame="390">
		<div class="toggle" role="group" aria-label="Frame width">
			<button type="button" data-frame="390" aria-pressed="true">390</button>
			<button type="button" data-frame="1440" aria-pressed="false">1440</button>
		</div>

		<main class="frame">
			<!--
				THE PROPOSITION GOES HERE.

				Drawn from the real data below — a 64-character trophy name is what
				breaks a row; a 12-character one proves nothing.
			-->
			<section style="padding: 24px">
				<h1 style="font-size: 24px; margin: 0 0 4px">${game.name}</h1>
				<p style="margin: 0; color: var(--pw-dim); font-size: 14px">
					${game.totalAchievements} achievements · ${game.types.length} tagged
				</p>

				<ul style="list-style: none; margin: 20px 0 0; padding: 0; display: grid; gap: 8px">
${sample
	.map(
		(a) => `					<li style="min-height: var(--tap); display: grid; gap: 4px; padding: 12px 14px; background: var(--pw-surface); border: 1px solid var(--pw-border); border-radius: 10px">
						<strong style="font-size: 15px">${a.name}</strong>
						<span style="font-size: 13px; color: var(--pw-dim)">${a.description}</span>
						<span style="font-size: 11px; color: var(--pw-faint)">${a.difficulty}${
							a.types.length ? ` · ${a.types.join(', ')}` : ''
						}</span>
					</li>`
	)
	.join('\n')}
				</ul>
			</section>
		</main>

		<aside class="caption">
			<strong>Variant ${variant}.</strong> What it borrows, what it costs, what it breaks elsewhere.
			A variant with no downside listed has not been thought about.
		</aside>

		<script type="application/json" id="game-data">${JSON.stringify(
			{ appId: game.appId, name: game.name, totalAchievements: game.totalAchievements, achievements: sample },
			null,
			'\t'
		)}</script>
		<script>
			for (const btn of document.querySelectorAll('.toggle button')) {
				btn.addEventListener('click', () => {
					document.body.dataset.frame = btn.dataset.frame;
					for (const b of document.querySelectorAll('.toggle button')) {
						b.setAttribute('aria-pressed', String(b === btn));
					}
				});
			}
		</script>
	</body>
</html>
`;
}

const NOTES_TEMPLATE = `# Mockups — {SLUG}

Scoped: {ONE LINE}
Aesthetic gate answered: {yes/no — and what was chosen}

| Variant | Idea in one line | Costs | Breaks | Worse for |
|---|---|---|---|---|
| a-inline | | | | |
| b-… | | | | |

**A variant with no downside listed has not been thought about.**

## States drawn

- [ ] empty
- [ ] loading
- [ ] error
- [ ] locked / unlocked
- [ ] long text
- [ ] zero results

## Questions for the user

1. Which one?
2. Is that one good enough to build, or does it need UI fixes?

## What this mockup does not decide

_(real data loading, keyboard behaviour, 500 games, SSR — say it here, not at build time)_
`;

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(HELP);
		return;
	}

	const games = await listGames();
	if (args.listGames) {
		for (const g of games) console.log(`${String(g.appId).padStart(8)}  ${String(g.count).padStart(3)}  ${g.name}`);
		return;
	}
	if (!args.slug) throw new Error('Missing slug. See --help.');

	const css = await readFile(APP_CSS, 'utf8');
	const html = await readFile(APP_HTML, 'utf8');
	const palettes = extractPalettes(css);
	if (!palettes[args.theme]) {
		throw new Error(
			`Unknown theme "${args.theme}". Available: ${Object.keys(palettes).join(', ')}\n` +
				'Add it to src/app.css first — a mockup must use the app\'s real palette.'
		);
	}
	const palette = palettes[args.theme];
	const fontHref = extractFontLink(html);

	const chosen = args.game
		? games.find((g) => String(g.appId) === args.game)
		: games[0];
	if (!chosen) throw new Error(`No game with appId ${args.game}. Use --list-games.`);

	const raw = JSON.parse(await readFile(join(GAMES_DIR, `${chosen.appId}.json`), 'utf8'));
	const game = {
		appId: raw.appId,
		name: raw.name,
		totalAchievements: raw.totalAchievements,
		types: [...new Set(raw.achievements.flatMap((a) => a.types))],
		achievements: raw.achievements
	};

	const dir = join(ROOT, '.tmp/ui', args.slug);
	await mkdir(join(dir, 'shots'), { recursive: true });

	for (const variant of args.variants) {
		await writeFile(
			join(dir, `${variant}.html`),
			starterHtml({ variant, themeId: args.theme, palette, fontHref, game }),
			'utf8'
		);
	}
	await writeFile(join(dir, 'notes.md'), NOTES_TEMPLATE.replaceAll('{SLUG}', args.slug), 'utf8');

	console.log(`Created .tmp/ui/${args.slug}/`);
	for (const variant of args.variants) console.log(`  ${variant}.html   (palette: ${args.theme}, data: ${game.name})`);
	console.log(`  notes.md`);
	console.log(`  shots/`);
	console.log(`\nNext:  node scripts/agent/shot.mjs .tmp/ui/${args.slug}`);
}

await run(main);