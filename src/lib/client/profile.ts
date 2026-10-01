import { browser } from '$app/env';
import type { SteamProfile } from '#lib/types/steam';

/**
 * The Steam profile is cached in localStorage so we only ever parse Steam after a
 * sync or an explicit refresh, never on a page load.
 */
const PROFILE_KEY = 'platworks:profile';
const STEAM_ID_KEY = 'platworks:steamId';

export interface StoredProfile extends SteamProfile {
	steamId: string;
	/** When the cache was written, for display/debug purposes. */
	cachedAt: number;
}

export function loadProfile(): StoredProfile | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(PROFILE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredProfile;
		// Guard against a stale/corrupt entry breaking the navbar.
		if (typeof parsed?.steamId !== 'string' || typeof parsed?.name !== 'string') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveProfile(profile: SteamProfile): StoredProfile | null {
	if (!browser) return null;
	const stored: StoredProfile = { ...profile, cachedAt: Date.now() };
	localStorage.setItem(PROFILE_KEY, JSON.stringify(stored));
	return stored;
}

export function clearProfile() {
	if (browser) localStorage.removeItem(PROFILE_KEY);
}

/**
 * Fetches the profile through the server route and updates the cache. Also adopts
 * the resolved Steam64 ID so later syncs skip vanity-name resolution.
 */
export async function refreshProfile(steamInput: string): Promise<StoredProfile | null> {
	if (!browser || !steamInput.trim()) return null;

	try {
		const res = await fetch(`/api/steam/profile?steamId=${encodeURIComponent(steamInput.trim())}`);
		const json = await res.json();
		if (!json.connected || !json.profile) return null;

		const stored = saveProfile(json.profile as SteamProfile);

		// Persist the resolved ID so future requests don't re-resolve a vanity name.
		if (stored && json.steamId && json.steamId !== steamInput) {
			localStorage.setItem(STEAM_ID_KEY, json.steamId);
		}

		return stored;
	} catch {
		return null;
	}
}
