import type { SteamGameDetails, SteamAchievementStatus } from '$lib/types/steam';

const STORE_API = 'https://store.steampowered.com/api';
const COMMUNITY = 'https://steamcommunity.com';

export async function getGameDetails(appId: number): Promise<SteamGameDetails | null> {
	const res = await fetch(`${STORE_API}/appdetails?appids=${appId}`);
	if (!res.ok) return null;

	const json = await res.json();
	const data = json[String(appId)];
	if (!data?.success) return null;

	const d = data.data;
	return {
		appId,
		name: d.name,
		shortDescription: d.short_description,
		headerImage: d.header_image,
		background: d.background_raw ?? d.background,
		metacriticScore: d.metacritic?.score ?? null,
		metacriticUrl: d.metacritic?.url ?? null
	};
}

/** Resolves any Steam input to a Steam64 ID using public XML profiles. */
export async function resolveSteamId(input: string): Promise<string | null> {
	const trimmed = input.trim();
	if (!trimmed) return null;

	if (/^\d{17}$/.test(trimmed)) return trimmed;

	const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/);
	if (profileMatch) return profileMatch[1];

	// Extract vanity name from URL or treat raw input as vanity name
	const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/\s]+)/);
	const vanityName = vanityMatch?.[1] ?? trimmed.replace(/\/$/, '');

	try {
		const res = await fetch(`${COMMUNITY}/id/${encodeURIComponent(vanityName)}/?xml=1`);
		if (!res.ok) return null;
		const xml = await res.text();
		const id = extractTag(xml, 'steamID64');
		if (id && /^\d{17}$/.test(id)) return id;
	} catch { /* unreachable profile */ }

	return null;
}

/** Fetches achievements from the public Steam community XML. Profile must be public. */
export async function getPlayerAchievements(
	appId: number,
	steamId: string
): Promise<Map<string, SteamAchievementStatus>> {
	if (!steamId) return new Map();

	// Try /profiles/{id} first, fall back to /id/{vanity} format
	const url = `${COMMUNITY}/profiles/${steamId}/stats/${appId}/?xml=1`;
	try {
		const res = await fetch(url);
		if (!res.ok) return new Map();
		const xml = await res.text();

		if (xml.includes('<error>') && !xml.includes('<achievements>')) {
			return new Map();
		}

		return parseAchievementXml(xml);
	} catch {
		return new Map();
	}
}

/** Strips quotes, punctuation, and collapses whitespace for fuzzy name matching. */
export function normalizeName(s: string): string {
	return s.toLowerCase().replace(/["''""«»`]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseAchievementXml(xml: string): Map<string, SteamAchievementStatus> {
	const map = new Map<string, SteamAchievementStatus>();

	const blocks = xml.match(/<achievement[^>]*>[\s\S]*?<\/achievement>/gi);
	if (!blocks) return map;

	for (const block of blocks) {
		const name = extractTag(block, 'name');
		if (!name) continue;

		const closedStr = block.match(/closed="(\d)"/i)?.[1] ?? extractTag(block, 'closed');
		const unlockStr = extractTag(block, 'unlockTimestamp');

		const achieved = closedStr === '1';
		const unlockTime = unlockStr ? new Date(Number(unlockStr) * 1000) : null;

		map.set(normalizeName(name), { achieved, unlockTime: achieved ? unlockTime : null });
	}

	return map;
}

function extractTag(xml: string, tag: string): string | null {
	const re = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tag}>|<${tag}>([^<]*)</${tag}>`, 'i');
	const m = xml.match(re);
	return m?.[1] ?? m?.[2] ?? null;
}
