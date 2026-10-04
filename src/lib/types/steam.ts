export interface SteamGameDetails {
	appId: number;
	name: string;
	shortDescription: string;
	/**
	 * Local path under `/images/games/{appId}/`, mirrored into the repo by
	 * `scripts/fetch-game-images.mjs`. Never a Steam CDN URL — the app must not
	 * depend on an external image host for artwork it could just as well ship.
	 */
	headerImage: string;
	/**
	 * Local path under `/images/games/{appId}/hero.jpg`, or null when the caller did
	 * not ask for one (see `getGameDetails`'s `hero` option). Steam's `header_image`
	 * is only 460x215, which goes visibly soft across a full-width hero. Not every
	 * game has one; when the file is absent the component's `onerror` reveals the
	 * placeholder beneath it.
	 */
	heroImage: string | null;
	metacriticScore: number | null;
	metacriticUrl: string | null;
}

export interface SteamAchievementStatus {
	achieved: boolean;
	unlockTime: Date | null;
}

export interface SteamProfile {
	steamId: string;
	name: string;
	/** Full-size avatar, or null when the account still uses Steam's default image. */
	avatar: string | null;
	avatarMedium: string | null;
	profileUrl: string;
	/** Steam visibility: 1 private, 3 public, 4 friends-only, 5 invite-only. */
	visibility: string | null;
}
