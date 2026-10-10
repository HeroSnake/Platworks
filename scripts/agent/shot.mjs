/**
 * Screenshots mockup HTML (or any URL) at every width a mockup must prove.
 *
 * Phase 3 of /ui-project requires every variant rendered at all four viewports with the
 * PNGs in the reply. This does that in one command, and reports the two things
 * that are cheaper to fix before a human looks at the image than after:
 *
 *   overflow  a horizontal scrollbar exists — fix it before showing the mockup
 *   errors    pageerror / console errors, which a screenshot hides completely
 *
 * `file://` URLs work and are verified.
 *
 * Usage:
 *   node scripts/agent/shot.mjs .tmp/ui/library-heatmap/a-inline-grid.html
 *   node scripts/agent/shot.mjs .tmp/ui/library-heatmap            # every .html in the dir
 *   node scripts/agent/shot.mjs <url> --out shots/x.png --widths 390
 *   node scripts/agent/shot.mjs .tmp/ui/library-heatmap --theme matrix
 *
 * Options:
 *   --widths <a,b>  Default: 390,768,1440,2560 — the four viewports.
 *   --out <path>    Single-file output. Ignored when screenshotting a directory.
 *   --out-dir <d>   Default: <mockup dir>/shots
 *   --theme <id>    A palette from src/app.css; sets [data-theme] on <html>.
 *   --full          Full-page shot (default). --viewport clips to the viewport.
 *   --height <n>    Viewport height per width. Default 900.
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, FRAME_LABELS } from './lib/playwright.mjs';
import { auditPage, INTERACTIVE_SELECTOR, CONTROL_SELECTORS, attachErrorCollectors } from './lib/ui-checks.mjs';
import { run } from './lib/cli.mjs';

/** Repo root, so scratch output lands in the gitignored `.tmp/` and never in the root. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const DEFAULT_WIDTHS = [390, 768, 1440, 2560];
const DEFAULT_HEIGHT = 900;

/** The same floor the app holds; a mockup drawn below it is not the app's design. */
const MIN_TAP_HEIGHT = 40;

function parseArgs(argv) {
	const args = { widths: DEFAULT_WIDTHS, out: null, outDir: null, theme: null, full: true, height: DEFAULT_HEIGHT };
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => argv[++i];
		if (arg === '--widths') args.widths = next().split(',').map((w) => parseInt(w, 10));
		else if (arg === '--out') args.out = next();
		else if (arg === '--out-dir') args.outDir = next();
		else if (arg === '--theme') args.theme = next();
		else if (arg === '--full') args.full = true;
		else if (arg === '--viewport') args.full = false;
		else if (arg === '--height') args.height = parseInt(next(), 10);
		else if (arg === '--help' || arg === '-h') args.help = true;
		else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
		else positional.push(arg);
	}
	args.target = positional[0];
		// `--help` must work without a target, so the requirement is only enforced on
		// a real invocation. Validating it in parseArgs makes `shot.mjs --help` fail,
		// which is the one moment someone needs it to work.
		if (!args.target && !args.help) throw new Error('Missing target. Pass an HTML file, a directory, or a URL.');
		return args;
	}

const HELP = `
shot.mjs — render a mockup (or any URL) at all four viewports and check it

  node scripts/agent/shot.mjs <html|dir|url> [options]

  --widths <a,b>  Default: 390,768,1440,2560
  --out <path>    Output PNG for a single file target
  --out-dir <d>   Default: <mockup dir>/shots
  --theme <id>    Palette from src/app.css, applied as [data-theme]
  --viewport      Clip to the viewport instead of the full page
  --height <n>    Viewport height. Default 900
`;

/** Every `.html` file directly inside a mockup directory. */
async function mockupFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	return entries
		.filter((e) => e.isFile() && e.name.endsWith('.html'))
		.map((e) => join(dir, e.name))
		.sort();
}

const isUrl = (t) => /^https?:\/\//.test(t);

/**
 * Drives a scaffolded mockup's OWN viewport selector to the width being shot.
 *
 * `new-mockup.mjs` gives every mockup a `body[data-frame]` selector plus a
 * `.frame[data-width]` element, but this script only set the BROWSER viewport —
 * so all four shots rendered whichever frame the file happened to open in, and
 * the four PNGs were one layout at four scales. The mockup gate relies on the
 * four being four different widths, so set the frame here. No-op on a page with
 * no such selector (a live route, a plain HTML page).
 */
async function driveMockupFrame(page, width) {
	const label = FRAME_LABELS[width];
	if (!label) return;
	await page.evaluate(
		({ label, width }) => {
			const frame = document.querySelector('.frame[data-width]');
			const btn = document.querySelector(`.toggle [data-frame="${label}"]`);
			if (!frame || !btn) return;
			document.body.dataset.frame = label;
			frame.dataset.width = String(width);
			// Viewport === frame width for the standard set, so no scale is needed.
			frame.style.transform = 'none';
			const fit = document.querySelector('.stage-fit');
			if (fit) fit.style.height = '';
			for (const b of document.querySelectorAll('.toggle [data-frame]')) {
				b.setAttribute('aria-pressed', String(b === btn));
			}
		},
		{ label, width }
	);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(HELP);
		return;
	}

	const target = args.target;
	let jobs = [];
	let outDir = args.outDir;

	if (isUrl(target)) {
		// A URL shot has no mockup directory to write into, so `outDir` was left
		// null and the `mkdir(outDir)` below threw `Received null` — every URL
		// invocation without an explicit `--out-dir` failed. Worse, the old default
		// (`shot-${width}.png`, a bare relative path) put PNGs in the CURRENT
		// WORKING DIRECTORY, which for an agent is the repo root, and the repo root
		// is not gitignored. Default into `.tmp/shots/`, which is ignored.
		outDir = args.outDir ?? join(ROOT, '.tmp', 'shots');
		jobs = args.widths.map((width) => ({
			url: target,
			width,
			// With several widths, an explicit `--out` would have every job write the
			// same file and silently keep only the last one. Splice the width in.
			out: args.out
				? args.widths.length > 1
					? args.out.replace(/(\.png)$/, `-${width}$1`)
					: args.out
				: join(outDir, `shot-${width}.png`)
		}));
	} else {
		const abs = resolve(target);
		const info = await stat(abs).catch(() => null);
		if (!info) throw new Error(`No such file or directory: ${target}`);

		if (info.isDirectory()) {
			const files = await mockupFiles(abs);
			if (!files.length) throw new Error(`No .html files in ${target}`);
			outDir = args.outDir ?? join(abs, 'shots');
			// All four viewports. The `a-`, `b-`, `c-` prefixes keep the
			// variant order visible in the shots folder.
			jobs = files.flatMap((file) =>
				args.widths.map((width) => ({
					url: pathToFileURL(file).href,
					width,
					out: join(outDir, `${file.split('/').pop().replace(/\.html$/, '')}-${width}.png`)
				}))
			);
		} else {
			const stem = abs.replace(/\.html?$/, '');
			outDir = args.outDir ?? join(dirname(abs), 'shots');
			jobs = args.widths.map((width) => ({
				url: pathToFileURL(abs).href,
				width,
				out: args.out ?? join(outDir, `${stem.split('/').pop()}-${width}.png`)
			}));
		}
	}

	await mkdir(outDir, { recursive: true });

	const browser = await launchBrowser();
	const results = [];
	try {
		for (const job of jobs) {
			// Fresh context per shot: a mockup that sets localStorage or scrolls must
			// not bleed into the next width of the same file.
			const context = await browser.newContext({
				viewport: { width: job.width, height: args.height },
				colorScheme: 'dark'
			});
			const page = await context.newPage();
			const errors = attachErrorCollectors(page);

			await page.goto(job.url, { waitUntil: 'networkidle', timeout: 30000 });

			// Apply the palette AFTER the document exists, not in `addInitScript`.
			//
			// `addInitScript` runs at document-start, before the parser has created
			// `<html>`, so `document.documentElement` is null and
			// `setAttribute` on it throws. That made `--theme` fail on every call
			// since it was written — it surfaced only as a `pageerror` in the
			// warnings, next to a perfectly good-looking screenshot, which is exactly
			// the failure mode this script exists to catch in the pages it audits.
			//
			// The flash this would cause in a real app is irrelevant here: nothing is
			// interactive, and the screenshot is taken after a settle below.
			if (args.theme) {
				await page.evaluate(
					(theme) => document.documentElement.setAttribute('data-theme', theme),
					args.theme
				);
			}

			// Drive the mockup's own viewport selector to this width (no-op off a mockup).
			await driveMockupFrame(page, job.width);

			await page.waitForTimeout(300);
			await page.screenshot({ path: job.out, fullPage: args.full });
			// The same geometry gate the mockup gate applies, so a mockup that
			// overflows or is built from 20px targets is caught before a human
			// reviews the picture.
			const { overflow, targets } = await page.evaluate(auditPage, {
				interactive: INTERACTIVE_SELECTOR,
				controls: CONTROL_SELECTORS,
				minHeight: MIN_TAP_HEIGHT,
				reach: 16
			});
			await context.close();

			results.push({
				...job,
				overflow: overflow.overflow,
				overflowPx: overflow.overflowPx,
				smallest: targets.smallest,
				errors
			});
		}
	} finally {
		await browser.close();
	}

	for (const r of results) {
		const status = r.errors.length || r.overflow ? 'WARN' : 'ok';
		console.log(
			`${status.padEnd(4)} ${String(r.width).padStart(4)}px  ${r.out}` +
				(r.overflow ? `  ← horizontal overflow +${r.overflowPx}px` : '') +
				(r.smallest !== null && r.smallest < MIN_TAP_HEIGHT ? `  ← smallest tap target ${r.smallest}px` : '') +
				(r.errors.length ? `  ← ${r.errors.join(' | ')}` : '')
		);
	}

	// Markdown for the chat reply: workspace-relative paths render in VS Code.
	console.log('\nEmbed in the reply:');
	for (const r of results) console.log(`![${r.out.split('/').pop()}](${r.out})`);

	if (results.some((r) => r.overflow || r.errors.length)) {
		console.log('\nFix the overflow and the errors before showing these to the user.');
		process.exitCode = 1;
	}
}

await run(main);