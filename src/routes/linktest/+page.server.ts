import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGameByAppId } from '#lib/server/games';
import type { GameData } from '#lib/types/game';

const APP_ID = 1903340;

export const load: PageServerLoad = async () => {
	// `#lib/server/*` is server-only, so this lookup must happen in a server load
	// rather than in the component — importing it in +page.svelte fails the client
	// build with `server_only_import`.
	const game = getGameByAppId(APP_ID);
	if (!game) error(404, 'Game not found');

	return { game } satisfies { game: GameData };
};
