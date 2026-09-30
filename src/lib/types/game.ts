export interface GameData {
	appId: number;
	name: string;
	totalAchievements: number;
	achievements: Achievement[];
}

export interface Achievement {
	id: string;
	name: string;
	description: string;
	/** 'missable' if it can be permanently missed in a playthrough */
	type: 'standard' | 'missable' | 'multiplayer' | 'cumulative' | 'secret';
	difficulty: 'easy' | 'medium' | 'hard' | 'very-hard';
	guide: AchievementGuide;
}

export interface AchievementGuide {
	steps: string[];
	/** URL to a video walkthrough */
	videoUrl?: string;
	/** URL to a written guide */
	sourceUrl?: string;
	/** Community tips, usually from Reddit */
	communityNotes?: string[];
	/** Warnings for missable or tricky achievements */
	warnings?: string[];
}
