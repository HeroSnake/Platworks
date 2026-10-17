/**
 * Parses Steam's community achievements page.
 *
 * Steam rebuilt that page as a React SSR app and retired the old markup:
 * `/stats/{appId}/achievements` now 302s to `/achievements/{appId}`, and the
 * response contains no `achieveRow`, `achieveImgHolder` or `<h3>` title — the
 * two scrapers that used to regex those elements silently matched nothing and
 * reported "no achievement rows" for every game.
 *
 * The list is still in the HTML, and it is *better* than the old one: SSR ships
 * a dehydrated react-query state inside `<script id="valve-ssr-data">`, and
 * `renderContext.queryData` holds two queries we want:
 *
 *   ["achievements", <appId>, "schema"]             → groups[].achievements[]
 *   ["achievements", <appId>, "globalpercentages"]  → percentages {internal_key: % }
 *
 * Each schema row carries `api_name` (the Steamworks apiname our `id` needs),
 * `name`, `description`, `hidden`, and both icon URLs — so this one signed-out
 * request replaces the retired page parse *and* the `GetSchemaForGame` call that
 * used to fill the ids (that endpoint now demands an API key for every app).
 *
 * The traps, all of which cost a run to find:
 *
 *   - The list is NOT in `loaderData`; that is only `{appid, appName}`. It is one
 *     level deeper, in `renderContext.queryData`, and that value is itself a
 *     JSON *string* that must be parsed a second time.
 *   - `queryData.queries[].queryKey` is an array whose third element names the
 *     dataset; matching on the string "schema" alone also hits other games' keys.
 *   - Percentages are keyed by `internal_key`, not by `api_name`, so the two
 *     queries have to be joined on that number.
 *   - `hidden` is a real boolean here — no more inferring it from a blanked
 *     description. This is the authoritative flag.
 *   - Only the un-achieved icon is described as "locked" in the UI; the app
 *     grayscales `iconUrl` itself, so store the *achieved* (coloured) icon.
 *
 * The request needs no cookie and no sign-in. A cookie banner may cover the page
 * in a browser, but it does not gate the data.
 */

export const PAGE_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** The canonical URL: the legacy `/stats/...` form only redirects here. */
export const achievementsUrl = (appId) => `https://steamcommunity.com/achievements/${appId}`;

const SSR_RE = /<script type="application\/json" id="valve-ssr-data"[^>]*>([\s\S]*?)<\/script>/;

/** Pulls one named dataset out of the dehydrated react-query state. */
function findQuery(queryData, dataset) {
	const queries = Array.isArray(queryData?.queries) ? queryData.queries : [];
	return queries.find(
		(q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'achievements' && q.queryKey[2] === dataset
	);
}

/**
 * @returns {{ gameName: string | null, rows: Array<{
 *   id: string | null, name: string, description: string, hidden: boolean,
 *   archived: boolean, unlockRate: number | null, iconUrl: string | null
 * }> }}
 */
export function parseAchievementPage(html) {
	const ssrMatch = SSR_RE.exec(html);
	if (!ssrMatch) {
		throw new Error(
			'No `valve-ssr-data` script on the page. Steam has changed the community ' +
				'achievements page again — update scripts/agent/lib/steam-achievements-page.mjs.'
		);
	}

	let ssr;
	try {
		ssr = JSON.parse(ssrMatch[1]);
	} catch (e) {
		throw new Error(`valve-ssr-data is not valid JSON (${e.message}).`);
	}

	const rawQueryData = ssr?.renderContext?.queryData;
	if (typeof rawQueryData !== 'string') {
		throw new Error('valve-ssr-data has no renderContext.queryData — the SSR payload shape changed.');
	}
	let queryData;
	try {
		queryData = JSON.parse(rawQueryData);
	} catch (e) {
		throw new Error(`renderContext.queryData is not valid JSON (${e.message}).`);
	}

	const schemaData = findQuery(queryData, 'schema')?.state?.data;
	const groups = schemaData?.groups;
	if (!Array.isArray(groups)) {
		throw new Error(
			'No ["achievements", <appId>, "schema"] query with groups[] in the SSR payload. ' +
				'The game may have no achievements, or the app id may be wrong.'
		);
	}

	// Percentages are keyed by internal_key, which is what the schema rows expose.
	const percentages = findQuery(queryData, 'globalpercentages')?.state?.data?.percentages ?? {};

	const rows = [];
	for (const group of groups) {
		for (const a of group.achievements ?? []) {
			const pct = percentages[String(a.internal_key)];
			rows.push({
				id: a.api_name ?? null,
				name: a.name ?? '',
				description: a.description ?? '',
				// Authoritative here, unlike the old page which blanked the <h5>.
				hidden: a.hidden === true,
				archived: a.archived === true,
				unlockRate: typeof pct === 'number' ? Math.round(pct * 10) / 10 : null,
				iconUrl: a.icon_achieved ?? a.icon_unachieved ?? null
			});
		}
	}

	if (!rows.length) throw new Error('The schema query has no achievement rows.');

	const gameName = /<title>Steam Community :: (.*?) :: Achievements<\/title>/.exec(html)?.[1]?.trim() ?? null;

	return { gameName, rows };
}

/** Fetches + parses in one step. */
export async function fetchAchievementPage(appId, { fetchImpl = fetch } = {}) {
	const url = achievementsUrl(appId);
	const res = await fetchImpl(url, {
		headers: { 'User-Agent': PAGE_UA, 'Accept-Language': 'en-US,en;q=0.9' },
		redirect: 'follow'
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
	return { url, ...parseAchievementPage(await res.text()) };
}
