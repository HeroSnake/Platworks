import { browser } from '$app/env';

/**
 * The player's own selection of games, kept apart from the imported catalogue.
 *
 * Everything under `#lib/data/games` is the *public* library: it grows whenever a
 * game is added to the repo. The *user* library is the subset the player actually
 * plays, and it is what their completion total is measured against — otherwise
 * adding a game to the repo would silently move someone's percentage.
 *
 * Stored as a JSON array of Steam appIds. Empty means "no selection yet", which the
 * library page reads as "show the public library".
 */
const LIBRARY_KEY = 'platworks:library';

function isValidAppId(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * A corrupt or hand-edited entry must not break the page, so every value is
 * validated and de-duplicated on read rather than trusted.
 */
export function loadLibrary(): number[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(LIBRARY_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return [...new Set(parsed.filter(isValidAppId))];
	} catch {
		return [];
	}
}

export function saveLibrary(appIds: number[]): number[] {
	if (!browser) return [];
	const clean = [...new Set(appIds.filter(isValidAppId))];
	try {
		localStorage.setItem(LIBRARY_KEY, JSON.stringify(clean));
	} catch {
		// Private-mode / quota failures are not worth breaking navigation over.
	}
	return clean;
}

export function addToLibrary(appId: number): number[] {
	return saveLibrary([...loadLibrary(), appId]);
}

export function removeFromLibrary(appId: number): number[] {
	return saveLibrary(loadLibrary().filter((id) => id !== appId));
}

/** Forgets the selection entirely, so the page falls back to the public library. */
export function clearLibrary(): number[] {
	return saveLibrary([]);
}