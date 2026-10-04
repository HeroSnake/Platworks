import { browser } from '$app/env';

/**
 * The player's colour palette.
 *
 * The palettes themselves live in `src/app.css` as `[data-theme]` blocks; this
 * module only owns *which one* is selected. It reads and writes a single
 * attribute on `<html>`, so every component follows without re-rendering.
 *
 * Stored as the theme id rather than a colour so a palette can be reworked in
 * CSS without invalidating anyone's saved choice.
 */
const THEME_KEY = 'platworks:theme';

/**
 * Ordered as they appear in the picker. Keep in step with the `[data-theme]`
 * blocks in `app.css` and with the validator in `src/app.html` — that one is a
 * separate copy because it runs before this module is ever fetched.
  *
  * `swatch`, `bg` and `success` must match the `[data-theme]` block exactly, or the
  * tile lies about what it selects. They are literals rather than read from CSS
  * because the picker has to show palettes that are *not* currently applied:
  * `var(--pw-accent)` resolves against whichever palette is on screen, so all six
  * previews would render identically. A palette edit in `app.css` must be copied
  * into this array.
  */
export const THEMES = [
	{ id: 'ember', label: 'Ember', swatch: '#ff7a45', bg: '#0c0a09', success: '#4ade80', blurb: 'molten' },
	{ id: 'amber', label: 'Amber', swatch: '#ffd27d', bg: '#120f09', success: '#6ee7a0', blurb: 'honey' },
	{ id: 'cobalt', label: 'Cobalt', swatch: '#4c8dff', bg: '#060910', success: '#3ddc97', blurb: 'azure' },
	{ id: 'matrix', label: 'Matrix', swatch: '#00ff66', bg: '#020604', success: '#00ff66', blurb: 'phosphor' },
	{ id: 'cyberpunk', label: 'Cyberpunk', swatch: '#00e5ff', bg: '#07060e', success: '#ff2d95', blurb: 'neon' },
	{ id: 'vapor', label: 'Vapor', swatch: '#c08bff', bg: '#0d0812', success: '#63e0a4', blurb: 'orchid' }
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const DEFAULT_THEME: ThemeId = 'ember';

function isThemeId(value: unknown): value is ThemeId {
	return typeof value === 'string' && THEMES.some((t) => t.id === value);
}

/** Never throws on a corrupt entry, and never runs on the server. */
export function loadTheme(): ThemeId {
	if (!browser) return DEFAULT_THEME;
	try {
		const stored = localStorage.getItem(THEME_KEY);
		return isThemeId(stored) ? stored : DEFAULT_THEME;
	} catch {
		return DEFAULT_THEME;
	}
}

/**
 * Writes the selection to storage and applies it to the document.
 *
 * Returns the id actually stored, so a rejected write cannot leave the UI
 * showing a palette that will not survive a reload.
 */
export function saveTheme(id: ThemeId): ThemeId {
	if (!browser || !isThemeId(id)) return DEFAULT_THEME;
	try {
		localStorage.setItem(THEME_KEY, id);
	} catch {
		// Private mode / quota. The attribute still applies for this page view.
	}
	document.documentElement.setAttribute('data-theme', id);
	return id;
}
