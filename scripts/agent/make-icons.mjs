/**
 * Rasterises `static/icon.svg` and `static/icon-maskable.svg` into the PNG sizes
 * the PWA manifest and iOS actually require.
 *
 * The artwork stays SVG so there is one editable source of truth, but a manifest
 * icon is only honoured by an install prompt when the platform can decode it.
 * Android's launcher and iOS "Add to Home Screen" both need raster `sizes` — an
 * SVG-only manifest installs with a blank tile on iOS and loses maskable support
 * everywhere. Hence committed PNGs.
 *
 * Chromium is the rasteriser (via `lib/playwright.mjs`) rather than `rsvg-convert`
 * or ImageMagick: the browser is already what every other script here drives, so
 * this adds no system prerequisite.
 *
 * Usage:
 *   node scripts/agent/make-icons.mjs           # rewrite the committed PNGs
 *   node scripts/agent/make-icons.mjs --check   # fail if a PNG is missing or stale
 *
 * `--check` is the form to use in review: it exits non-zero when a PNG is absent
 * or was generated from an older SVG, and never touches the working tree.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './lib/playwright.mjs';
import { run } from './lib/cli.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATIC = join(ROOT, 'static');

/**
 * Every raster icon the app ships, and the SVG each is generated from.
 *
 * `apple-touch-icon` is generated from `icon.svg` even though that file already
 * draws a rounded `rx=96` rect: iOS applies its own rounding on top, and a
 * pre-rounded square inside a rounded mask reads as a doubled corner. The
 * manifest entry points at the same PNG.
 */
const TARGETS = [
	{ file: 'icon-192.png', from: 'icon.svg', size: 192, purpose: 'any' },
	{ file: 'icon-512.png', from: 'icon.svg', size: 512, purpose: 'any' },
	{ file: 'icon-maskable-192.png', from: 'icon-maskable.svg', size: 192, purpose: 'maskable' },
	{ file: 'icon-maskable-512.png', from: 'icon-maskable.svg', size: 512, purpose: 'maskable' },
	{ file: 'apple-touch-icon.png', from: 'icon.svg', size: 180, purpose: 'apple' }
];

/**
 * Android crops a maskable icon to the middle ~80% of the tile, so artwork that
 * fills the tile edge-to-edge loses its corners to the launcher mask.
 * `icon-maskable.svg` deliberately fills the whole square — the background has to
 * reach the edges or the mask shows through — but the trophy inside it has to be
 * inset to stay inside the safe zone. Hence scaling the artwork, not the file.
 */
const MASKABLE_SAFE_ZONE = 0.8;

/**
 * Wraps an SVG in a document sized exactly to the icon.
 *
 * `margin: 0` is load-bearing: the default 8px body margin offsets every raster
 * by 8px and letterboxes it against the viewport edge.
 */
function document(svgMarkup, size, maskable) {
	const frame = maskable ? size * MASKABLE_SAFE_ZONE : size;
	return `<!doctype html><html><head><meta charset="utf-8"><style>
		html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:#171a21}
		.frame{width:${frame}px;height:${frame}px;display:grid;place-items:center}
		.frame>svg{display:block;width:100%;height:100%}
	</style></head><body><div class="frame">${svgMarkup}</div></body></html>`;
}

async function main() {
	const check = process.argv.includes('--check');
	const stale = [];
	const browser = await launchBrowser();

	try {
		for (const target of TARGETS) {
			// The XML prolog is legal in a standalone .svg but not as HTML body
			// content, so it is stripped before the markup is inlined.
			const svg = (await readFile(join(STATIC, target.from), 'utf8'))
				.replace(/<\?xml[^>]*\?>/, '')
				.trim();

			const ctx = await browser.newContext({
				viewport: { width: target.size, height: target.size },
				deviceScaleFactor: 1
			});
			const tab = await ctx.newPage();
			await tab.setContent(document(svg, target.size, target.purpose === 'maskable'), {
				waitUntil: 'load'
			});
			const produced = await tab.screenshot({
				type: 'png',
				clip: { x: 0, y: 0, width: target.size, height: target.size }
			});
			await ctx.close();

			const outPath = join(STATIC, target.file);
			const existing = await readFile(outPath).catch(() => null);

			if (existing && Buffer.compare(existing, produced) === 0) {
				if (check) console.log(`ok    ${target.file}`);
				continue;
			}

			stale.push(target.file);
			if (check) {
				console.error(`STALE ${target.file} - missing, empty, or from an older SVG`);
			} else {
				await writeFile(outPath, produced);
				console.log(`wrote ${target.file}  ${target.size}px ${target.purpose}`);
			}
		}
	} finally {
		await browser.close();
	}

	if (!check) {
		console.log(`\n${TARGETS.length - stale.length}/${TARGETS.length} icons already current.`);
		return;
	}
	if (stale.length) {
		console.error(`\nRun: node scripts/agent/make-icons.mjs`);
		process.exit(1);
	}
	console.log(`\nAll ${TARGETS.length} icon PNGs are current.`);
}

run(main);