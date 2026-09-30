import type { PageServerLoad } from './$types';
import { getAllGames } from '$lib/server/games';
import { getGameDetails, normalizeName } from '$lib/server/steam/api';
import type { SteamGameDetails } from '$lib/types/steam';

export interface GameListItem {
	appId: number;
	name: string;
	totalAchievements: number;
	achievementIds: string[];
	achievementNames: Record<string, string>;
	steam: SteamGameDetails | null;
}

export const load: PageServerLoad = async () => {
	const games = getAllGames();

	const items: GameListItem[] = await Promise.all(
		games.map(async (g) => {
			const steam = await getGameDetails(g.appId);
			return {
				appId: g.appId,
				name: steam?.name ?? g.name,
				totalAchievements: g.totalAchievements,
				achievementIds: g.achievements.map((a) => a.id),
				achievementNames: Object.fromEntries(g.achievements.map((a) => [normalizeName(a.name), a.id])),
				steam
			};
		})
	);

	return { games: items };
};
