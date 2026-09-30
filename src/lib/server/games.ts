import type { GameData } from '$lib/types/game';

const dataFiles = import.meta.glob<GameData>('$lib/data/games/[0-9]*.json', {
	eager: true,
	import: 'default'
});

export function getAllGames(): GameData[] {
	return Object.values(dataFiles);
}

export function getGameByAppId(appId: number): GameData | undefined {
	return getAllGames().find((g) => g.appId === appId);
}
