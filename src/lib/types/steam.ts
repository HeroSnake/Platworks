export interface SteamGameDetails {
	appId: number;
	name: string;
	shortDescription: string;
	headerImage: string;
	/**
	 * Wide banner for the game-page hero, or null when the caller did not ask for one
	 * (see `getGameDetails`'s `hero` option). Steam's `header_image` is only 460x215,
	 * which goes visibly soft stretched across a full-width hero.
	 */
	heroImage: string | null;
	background: string;
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
