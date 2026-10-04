import type { SteamGameDetails, SteamAchievementStatus, SteamProfile } from '#lib/types/steam';

const STORE_API = 'https://store.steampowered.com/api';
const COMMUNITY = 'https://steamcommunity.com';

export interface GetGameDetailsOptions {
	/**
	 * Include the wide `hero.jpg` banner. Off by default: the library page calls this
	 * for every game and never renders a hero. The single-game page opts in.
	 */
	hero?: boolean;
}

/**
 * Game artwork is committed to `static/images/games/{appId}/` and served from
 * there — the app must never request Steam's CDN for a header or hero.
 *
 * `scripts/fetch-game-images.mjs` owns those files. It resolves the URLs from
 * `appdetails`, because the obvious un-hashed CDN path is a guess that 404s for
 * some apps: Steam serves those from a content-hashed directory instead
 * (`/apps/4126040/bf9b76d2…/header.jpg`). Aniimo and WARDOGS are both in that
 * group. `appdetails` also 403s intermittently from Node, which is what made
 * artwork appear and vanish between reloads; since the files now live in the repo,
 * none of that can affect rendering.
 *
 * The achievement icons are the deliberate exception and still load from Steam —
 * 1647 of them would add far too much to the repo. See
 * `scripts/fetch-achievement-icons.mjs`.
 */
const localHeader = (appId: number) => `/images/games/${appId}/header.jpg`;
const localHero = (appId: number) => `/images/games/${appId}/hero.jpg`;

/**
 * Successful `appdetails` responses, kept for the life of the server process.
 *
 * Artwork no longer depends on this, but name, description and the Metacritic
 * score do, and the store API intermittently 403s from Node. Caching means one
 * success is enough and a later 403 cannot blank out every game's blurb.
 *
 * Artwork does not change for a shipped app, so there is no TTL.
 */
const detailsCache = new Map<number, SteamGameDetails>();

/**
 * When `appdetails` is blocked we still return local artwork, so the library
 * never renders empty image slots. Name/description stay empty — callers fall
 * back to local game JSON for the title (`steam?.name || game.name`).
 */
function fallbackDetails(appId: number, heroImage: string | null): SteamGameDetails {
	return {
		appId,
		name: '',
		shortDescription: '',
		headerImage: localHeader(appId),
		heroImage,
		metacriticScore: null,
		metacriticUrl: null
	};
}

export async function getGameDetails(
	appId: number,
	{ hero = false }: GetGameDetailsOptions = {}
): Promise<SteamGameDetails | null> {
	// A cached entry already has the authoritative header URL, so there is nothing
	// to re-fetch. See the cache comment for why this is correctness, not speed.
	const cached = detailsCache.get(appId);
	if (cached) return hero && !cached.heroImage ? { ...cached, heroImage: localHeroImage(appId) } : cached;

	const heroImage = hero ? localHeroImage(appId) : null;

	// Without `l=english`, Steam geo-localizes name/description. Browser UA: bare
	// Node fetches are frequently Access-Denied by Akamai on store.steampowered.com.
	//
	// Two attempts with a short gap: the 403 is intermittent rather than a hard
	// block, and a retry is far cheaper than shipping a game with no artwork.
	for (let attempt = 0; attempt < 2; attempt++) {
		if (attempt > 0) await new Promise((r) => setTimeout(r, 250));

		try {
			const res = await fetch(`${STORE_API}/appdetails?appids=${appId}&l=english`, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					Accept: 'application/json'
				}
			});
			if (res.ok) {
				const json = await res.json();
				const data = json[String(appId)];
				if (data?.success) {
					const d = data.data;
					const details: SteamGameDetails = {
						appId,
						name: d.name,
						shortDescription: d.short_description,
						// Local paths, always — never Steam's CDN, even though `appdetails`
						// hands us a perfectly good `header_image`.
						headerImage: localHeader(appId),
						heroImage,
						metacriticScore: d.metacritic?.score ?? null,
						metacriticUrl: d.metacritic?.url ?? null
					};
					detailsCache.set(appId, details);
					return details;
				}
			}
		} catch {
			/* retry, then fall through to CDN-only details */
		}
	}

	// Store API down / 403 — keep images alive via the asset CDN.
	return fallbackDetails(appId, heroImage);
}

/**
 * Steam's store-page hero banner (1920x620), mirrored to
 * `static/images/games/{appId}/hero.jpg` by `scripts/fetch-game-images.mjs`.
 *
 * Roughly one game in a dozen has none on Steam. There is no probe for that: the
 * probe used to be a HEAD request to the CDN, which was an external call on every
 * game page load for information the client can discover for free — a missing
 * file 404s and the component's `onerror` reveals the placeholder underneath.
 */
function localHeroImage(appId: number): string | null {
	return localHero(appId);
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

/** Fetches the public profile card (persona name + avatar) for a Steam64 ID. */
export async function getPlayerProfile(steamId: string): Promise<SteamProfile | null> {
	if (!/^\d{17}$/.test(steamId)) return null;

	try {
		const res = await fetch(`${COMMUNITY}/profiles/${steamId}/?xml=1`, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9',
				'Accept-Language': 'en-US,en;q=0.9',
			},
			cache: 'no-store'
		});
	
		if (!res.ok) return null;
		const xml = await res.text();
		if (xml.includes('<error>')) return null;

		// Steam's profile XML carries the display name in <steamID> — there is no
		// <personaname> tag (that one only exists on the stats XML). A private profile
		// still returns 200, but without these fields, which is how we detect it.
		const name = extractTag(xml, 'personaname') ?? extractTag(xml, 'steamID');
		if (!name) return null;

		// Steam always emits an avatar tag, using an all-zero hash for accounts with no
		// custom avatar, so callers get null and can fall back to an icon instead.
		const clean = (url: string | null) => {
			if (!url) return null;
			if (url.includes('default_avatar')) return null;
			// e.g. .../0000000000000000000000000000000000000000_full.jpg
			const hash = /steamstatic\.com\/([a-f0-9]+)_/.exec(url)?.[1];
			if (hash && /^0+$/.test(hash)) return null;
			return url;
		};

		return {
			steamId,
			name,
			avatar: clean(extractTag(xml, 'avatarFull') ?? extractTag(xml, 'avatarMedium') ?? extractTag(xml, 'avatarIcon')),
			avatarMedium: clean(extractTag(xml, 'avatarMedium') ?? extractTag(xml, 'avatarIcon')),
			profileUrl: `${COMMUNITY}/profiles/${steamId}`,
			visibility: extractTag(xml, 'visibilityState')
		};
	} catch (error) {
		console.error('Failed to fetch Steam profile:', error);
		return null;
	}
}

/** Fetches achievements from the public Steam community XML. Profile must be public. */
export async function getPlayerAchievements(
    appId: number,
    steamId: string
): Promise<Map<string, SteamAchievementStatus>> {
    if (!steamId) return new Map();

    const url = `${COMMUNITY}/profiles/${steamId}/stats/${appId}/?xml=1`;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            // Disable caching if running on Next.js / Vercel to ensure fresh data
            cache: 'no-store',
        });

        if (!res.ok) return new Map();
        const xml = await res.text();

        if (xml.includes('<error>') && !xml.includes('<achievements>')) {
            return new Map();
        }

        return parseAchievementXml(xml);
    } catch (error) {
        console.error('Failed to fetch Steam XML:', error);
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
