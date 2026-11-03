import { browser } from '$app/env';

/**
 * Persisted completion state for a game's checklist tab.
 *
 * One key per game (`platworks:checklist:{appId}`), a `Record<stepId, true>`, for
 * the same reason the trophy key is per game: a checklist step id is only unique
 * inside its own game.
 *
 * The loader validates rather than trusts. A hand-edited or half-written entry
 * must not throw during hydration, and it must not resurrect a step that no
 * longer exists — the caller intersects the result with the authored steps, so a
 * renamed step simply comes back unticked instead of leaving a ghost flag.
 */
const KEY = (appId: number) => `platworks:checklist:${appId}`;

export type ChecklistState = Record<string, boolean>;

export function loadChecklist(appId: number): ChecklistState {
	if (!browser) return {};
	try {
		const raw = JSON.parse(localStorage.getItem(KEY(appId)) ?? '{}');
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
		const clean: ChecklistState = {};
		for (const [id, value] of Object.entries(raw)) {
			if (value === true && typeof id === 'string' && id.length <= 120) clean[id] = true;
		}
		return clean;
	} catch {
		return {};
	}
}

export function saveChecklist(appId: number, state: ChecklistState): void {
	if (!browser) return;
	try {
		localStorage.setItem(KEY(appId), JSON.stringify(state));
	} catch {
		// Quota or a locked-down profile: the tab still works for this session.
	}
}
