export interface SteamGameDetails {
	appId: number;
	name: string;
	shortDescription: string;
	headerImage: string;
	background: string;
	metacriticScore: number | null;
	metacriticUrl: string | null;
}

export interface SteamAchievementStatus {
	achieved: boolean;
	unlockTime: Date | null;
}
