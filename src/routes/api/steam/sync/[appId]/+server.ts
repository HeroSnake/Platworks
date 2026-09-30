import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlayerAchievements, resolveSteamId } from '$lib/server/steam/api';

export const GET: RequestHandler = async ({ params, url }) => {
	const appId = Number(params.appId);
	if (isNaN(appId)) error(400, 'Invalid app ID');

	const steamInput = url.searchParams.get('steamId');
	if (!steamInput?.trim()) {
		return json({ connected: false, error: 'No Steam ID provided.' });
	}

	const resolvedId = await resolveSteamId(steamInput);
	if (!resolvedId) {
		return json({ connected: false, error: 'Could not resolve Steam profile. Check the ID, name, or URL.' });
	}

	const playerMap = await getPlayerAchievements(appId, resolvedId);
	if (playerMap.size === 0) {
		return json({ connected: false, error: 'No achievements found. Profile may be private or game not played.' });
	}

	const achievements: Record<string, { achieved: boolean; unlockTime: string | null }> = {};
	for (const [key, val] of playerMap) {
		achievements[key] = {
			achieved: val.achieved,
			unlockTime: val.unlockTime?.toISOString() ?? null
		};
	}

	return json({ connected: true, steamId: resolvedId, achievements });
};
