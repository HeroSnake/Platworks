/**
 * Fails when a game has no committed artwork.
 *
 * `scripts/fetch-game-images.mjs` mirrors `header.jpg` (460x215) and `hero.jpg`
 * (1920x620) into `static/images/games/{appId}/`, and the app serves those local
 * files — the card and the game-page hero render a placeholder when they are
 * missing. Forgetting that fetch leaves a game that looks broken while every other
 * check passes, so it is asserted here rather than left to the reviewer's eye.
 *
 * The dimensions are checked too, not just existence: a truncated download or a
 * placeholder saved under the right name is invisible to a byte count.
 *
 * Usage:  node scripts/agent/check-game-assets.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMES_DIR = join(ROOT, 'src/lib/data/games');
const IMAGES_DIR = join(ROOT, 'static/images/games');

/** Both files and the exact size `fetch-game-images.mjs` writes. */
const EXPECTED = [
	{ file: 'header.jpg', width: 460, height: 215 },
	{ file: 'hero.jpg', width: 1920, height: 620 }
];

/** Width/height from a baseline JPEG, read from its Start-Of-Frame marker. */
function jpegSize(buf) {
	if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
	let i = 2;
	while (i < buf.length - 9) {
		if (buf[i] !== 0xff) {
			i++;
			continue;
		}
		const marker = buf[i + 1];
		// SOF0..SOF15 minus the non-frame markers DHT (c4), JPG (c8) and DAC (cc).
		if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
			return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
		}
		if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
			i += 2;
			continue;
		}
		i += 2 + buf.readUInt16BE(i + 2);
	}
	return null;
}

const appIds = (await readdir(GAMES_DIR))
	.map((f) => /^(\d+)\.json$/.exec(f)?.[1])
	.filter(Boolean)
	.sort((a, b) => Number(a) - Number(b));

const problems = [];
for (const appId of appIds) {
	for (const { file, width, height } of EXPECTED) {
		const path = join(IMAGES_DIR, appId, file);
		let bytes;
		try {
			bytes = await readFile(path);
		} catch {
			problems.push(`${appId}: missing ${file} — run: node scripts/fetch-game-images.mjs ${appId}`);
			continue;
		}
		const size = await stat(path);
		const dim = jpegSize(bytes);
		if (!size.size) problems.push(`${appId}: ${file} is empty`);
		else if (!dim) problems.push(`${appId}: ${file} is not a readable JPEG`);
		else if (dim.width !== width || dim.height !== height)
			problems.push(`${appId}: ${file} is ${dim.width}x${dim.height}, expected ${width}x${height}`);
	}
}

console.log(`game artwork: ${appIds.length} games checked, ${problems.length} problem(s)`);
if (problems.length) {
	for (const p of problems) console.log(`  - ${p}`);
	process.exitCode = 1;
}
