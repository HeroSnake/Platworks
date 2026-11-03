export interface GameData {
	appId: number;
	name: string;
	totalAchievements: number;
	/**
	 * Interactive map for the whole game, when one good one exists. Prefer a
	 * maintained map over a dead wiki link, and omit the field entirely for linear
	 * or multiplayer games where a map would not help.
	 */
	mapUrl?: string;
	/**
	 * Optional per-game completion checklist, rendered as a second tab on the game
	 * page. Omitted for games with no authored checklist — the tab simply does not
	 * appear, so every existing game stays valid.
	 *
	 * Groups are ordered as the player meets them (Act 1 → DLC). A step's `id` is
	 * the persistence key, so renaming one resets that tick for everyone.
	 */
	checklist?: ChecklistGroup[];
	achievements: Achievement[];
}

export interface ChecklistGroup {
	id: string;
	/** Short label, e.g. "Act 1" */
	label: string;
	/** What the group covers, e.g. "Base and the first two Arks" */
	title: string;
	steps: ChecklistStep[];
}

export interface ChecklistStep {
	/** Stable slug, unique within the game. Persisted — do not rename casually. */
	id: string;
	text: string;
	/** Exact achievement names this step feeds. Matches `Achievement.name`. */
	trophies?: string[];
	/** Can be lost by leaving the act or by a one-shot choice. */
	missable?: boolean;
	/**
	 * One line explaining the deadline. Present only when the step genuinely
	 * expires; its absence is what renders the "no deadline" state, so do not
	 * write filler here.
	 */
	deadline?: string;
}

/**
 * Non-exclusive traits an achievement can carry. Deliberately omits `standard`:
 * a plain trophy is the *absence* of tags (`types: []`), not a tag itself. Allowing
 * `standard` alongside a real one would permit contradictions like
 * `['standard', 'secret']`.
 */
export type AchievementType = 'missable' | 'multiplayer' | 'cumulative' | 'secret';

export interface Achievement {
	id: string;
	name: string;
	description: string;
	/**
	 * Official Steam icon, scraped from the global achievement list by
	 * `scripts/fetch-achievement-icons.mjs`. Always the *unlocked* (coloured)
	 * variant — the locked look is a CSS grayscale of the same file, so there is
	 * no second URL to store. Optional: games added by hand may not have one yet.
	 */
	iconUrl?: string;
	/**
	 * Tags describing how the achievement can be earned. They are non-exclusive:
	 * a trophy can be both `secret` and `missable`, or `cumulative` and `multiplayer`.
	 * An empty array means an ordinary trophy with no notable traits — there is no
	 * `standard` tag.
	 */
	types: AchievementType[];
	difficulty: 'easy' | 'medium' | 'hard' | 'very-hard';
	guide: AchievementGuide;
}

export interface AchievementGuide {
	steps: string[];
	/** URL to a video walkthrough */
	videoUrl?: string;
	/** URL to a written guide, ideally a deep link for this specific achievement */
	sourceUrl?: string;
	/**
	 * Interactive map deep link for this achievement's location. Falls back to the
	 * game's own `mapUrl` in the UI, so only set it when the achievement is tied to
	 * a specific spot worth linking straight to.
	 */
	mapUrl?: string;
	/** Community tips, usually from Reddit */
	communityNotes?: string[];
	/** Warnings for missable or tricky achievements */
	warnings?: string[];
}
