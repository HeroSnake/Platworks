import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlayerProfile, resolveSteamId } from '#lib/server/steam/api';

/**
 * Resolves the Steam profile card (persona name + avatar). The client caches the
 * result in localStorage and only calls this after a sync or an explicit refresh,
 * so page loads never hit Steam.
 */
export const GET: RequestHandler = async ({ url }) => {
	const steamInput = url.searchParams.get('steamId');
	if (!steamInput?.trim()) {
		return json({ connected: false, error: 'No Steam ID provided.' });
	}

	const resolvedId = await resolveSteamId(steamInput);
	if (!resolvedId) {
		return json({ connected: false, error: 'Could not resolve Steam profile. Check the ID, name, or URL.' });
	}

	const profile = await getPlayerProfile(resolvedId);
	if (!profile) {
		return json({ connected: false, error: 'Could not read the Steam profile. It may be private.' });
	}

	// The resolved Steam64 ID comes back so the client can store it and skip vanity
	// resolution on subsequent requests.
	return json({ connected: true, steamId: resolvedId, profile });
};
