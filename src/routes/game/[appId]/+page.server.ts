import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGameByAppId } from '#lib/server/games';
import { getGameDetails } from '#lib/server/steam/api';
import type { SteamGameDetails } from '#lib/types/steam';
import type { GameData } from '#lib/types/game';

export interface GamePageData {
	game: GameData;
	steam: SteamGameDetails | null;
}

export const load: PageServerLoad = async ({ params }) => {
	const appId = Number(params.appId);
	if (isNaN(appId)) error(400, 'Invalid app ID');

	const game = getGameByAppId(appId);
	if (!game) error(404, 'Game not found');

	// `hero: true` — this is the only page that renders a wide banner, and it is the
	// only one that can afford the extra HEAD probe (the library loads every game).
	const steam = await getGameDetails(appId, { hero: true });

	return { game, steam } satisfies GamePageData;
};
