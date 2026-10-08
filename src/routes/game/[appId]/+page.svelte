<script lang="ts">
	import {
		ArrowLeft,
		Trophy,
		WifiOff,
		Star,
		Lock,
		Unlock,
		RefreshCw,
		MapPinned
	} from '@lucide/svelte';
	import AchievementRow from '#lib/components/achievement_row.svelte';
	import MobileBar from '#lib/components/mobile_bar.svelte';
	import GameFilters from '#lib/components/game_filters.svelte';
	import ProgressBar from '#lib/components/progress_bar.svelte';
	import ActionButton from '#lib/components/action_button.svelte';
	import { browser } from '$app/env';
import { untrack } from 'svelte';
	import { refreshProfile } from '#lib/client/profile';
		import { countUp } from '#lib/client/countup';

	let { data } = $props();

	let storageKey = $derived(`platworks:checked:${data.game.appId}`);

	// The wide library_hero banner when Steam has one, otherwise the 460x215 header.
	// Both are decorative here — the h1 carries the name.
	let heroImage = $derived(data.steam?.heroImage ?? data.steam?.headerImage ?? null);

	let localChecked = $state<Record<string, boolean>>(loadLocal());
	let syncing = $state(false);
	let syncError = $state<string | null>(null);
	let syncSuccess = $state<string | null>(null);

	function loadLocal(): Record<string, boolean> {
		if (!browser) return {};
		try {
			return JSON.parse(localStorage.getItem(storageKey) ?? '{}');
		} catch {
			return {};
		}
	}

	function saveLocal() {
		if (!browser) return;
		localStorage.setItem(storageKey, JSON.stringify(localChecked));
		localStorage.setItem(`platworks:lastChecked:${data.game.appId}`, String(Date.now()));
	}

	// Read once into reactive state — the template previously called
	// getSteamId() inline, which hit localStorage on every re-render.
	let steamId = $state(loadSteamId());

	function loadSteamId(): string {
		return browser ? (localStorage.getItem('platworks:steamId') ?? '') : '';
	}

	let achievedMap = $derived.by(() => {
		const map: Record<string, boolean> = {};
		for (const a of data.game.achievements) {
			map[a.id] = localChecked[a.id] || false;
		}
		return map;
	});

	/**
		 * Flips one trophy and settles the row against the active filter.
		 *
		 * Shared by the tap and the Steam-sync path because the two differ only in
		 * WHO decided: a finger and Steam's XML both write `localChecked`, and both
		 * can push the row out of a Locked or tag filter. Sync used to assign the flag
		 * directly, which left those rows to be destroyed by the keyed `{#each}` in
		 * the same flush — the collapse that explains the disappearance was painted
		 * on a node that no longer existed.
		 *
		 * Membership is read BEFORE the flip, because `localChecked` is what
		 * `achievedMap`, `passesCompletion` and therefore `visibleAchievements` derive
		 * from: the row can drop out of the list on this very line.
		 */
		function setChecked(id: string, next: boolean) {
			const wasListed = visibleAchievements.some((a) => a.id === id);
			localChecked[id] = next;
			if (wasListed && !visibleAchievements.some((a) => a.id === id)) {
				depart(id);
				return;
			}
			// Back inside the filter. This is the second tap of a double toggle: without
			// this the row stays in `departing` even though it is legitimately listed, so
			// `advance()` still hands over to `.pw-exit` and the card collapses and fades
			// for a row that never left. `release` is a no-op when the id is not held.
			release(id);
		}

		function toggleCheck(id: string) {
			setChecked(id, !localChecked[id]);
			saveLocal();
		}

		/**
		 * Achievement id → an ever-increasing token, so each row can tell "celebrate
		 * now" from "already celebrated" and the page can clear it afterwards. See
		 * the `celebration` prop in `achievement_row.svelte`.
		 */
		let celebrations = $state<Record<string, number>>({});

		/** `pw-celebrate` runs 900ms in app.css; the row's own timer outlives it by 20ms. */
		const CELEBRATE_MS = 940;

		function celebrate(ids: string[]) {
			const next = { ...celebrations };
			for (const id of ids) next[id] = (next[id] ?? 0) + 1;
			celebrations = next;
			setTimeout(() => {
				celebrations = {};
			}, CELEBRATE_MS);
		}

		async function syncWithSteam() {
			const sid = steamId;
			if (!sid) {
				syncError = 'Set your Steam ID in the account menu (top right)';
				return;
			}
			syncing = true;
			syncError = null;
			syncSuccess = null;
			try {
				const url = `/api/steam/sync/${data.game.appId}?steamId=${encodeURIComponent(sid)}`;
				const res = await fetch(url);
				const json = await res.json();
				if (!json.connected) {
					syncError = json.error ?? 'Could not fetch achievements. Is the profile public?';
					return;
				}
				// Steam XML keys are lowercase achievement names — match against game data names
				const steamMap = json.achievements as Record<string, { achieved: boolean; unlockTime: string | null }>;
				// Collected rather than celebrated inline: the page has to be told all at
				// once, because each row's effect fires on its own token and a token set
				// mid-loop would be cleared by the next iteration's reassignment.
				const fresh: string[] = [];
				for (const a of data.game.achievements) {
					const key = a.name.toLowerCase().replace(/["'\u2018\u2019\u201c\u201d\u00ab\u00bb`]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
					const steamEntry = steamMap[key];
					if (steamEntry?.achieved && !localChecked[a.id]) {
						setChecked(a.id, true);
						fresh.push(a.id);
					}
				}
				saveLocal();
				if (fresh.length) celebrate(fresh);
				syncSuccess = fresh.length > 0 ? `Synced ${fresh.length} achievement${fresh.length > 1 ? 's' : ''}` : 'Already up to date';
			// Take the opportunity to refresh the cached profile card (avatar/name).
			// The navbar reads it from localStorage, so this is the only time we
			// re-parse Steam for profile data — page loads stay network-free.
			refreshProfile(sid);
			setTimeout(() => syncSuccess = null, 3000);
		} catch {
			syncError = 'Failed to connect to Steam';
		} finally {
			syncing = false;
		}
	}

	type FilterValue = 'all' | 'locked' | 'unlocked';
	type SortValue = 'default' | 'difficulty' | 'name';

	// Completion filter + sort are global preferences, while the type filter is scoped
		// per game because every game exposes its own set of achievement tags.
	let filter = $state<FilterValue>('all');
		// 'all' plus any tag present in the game, plus the synthetic 'standard' entry for
		// trophies that carry no tags at all.
		let typeFilter = $state<string>('all');
		let gameSort = $state<SortValue>('default');
		// Session-only: a trophy search is transient, unlike the filters below.
		let trophyQuery = $state('');

		function loadPrefs(appId: number): { filter: FilterValue; typeFilter: string; gameSort: SortValue } {
			const fallback = { filter: 'all' as FilterValue, typeFilter: 'all', gameSort: 'default' as SortValue };
			if (!browser) return fallback;
			try {
				const f = localStorage.getItem(`platworks:filter:${appId}`);
				const t = localStorage.getItem(`platworks:typeFilter:${appId}`);
				const s = localStorage.getItem('platworks:gameSort');
				// Drop a stored tag the game no longer defines (data files get regenerated).
				const tags = new Set<string>(data.game.achievements.flatMap((a) => a.types));
				const valid = t && (t === 'standard' || tags.has(t)) ? t : 'all';
				return {
					filter: f === 'locked' || f === 'unlocked' ? f : 'all',
					typeFilter: valid,
					gameSort: s === 'difficulty' || s === 'name' ? s : 'default'
				};
			} catch {
				return fallback;
			}
		}

	// Same hydration hazard as the library grid: the server always renders "default"
	// order, so letting a persisted sort drive the first client render would hydrate the
	// keyed list out of order and pair rows with the wrong data. `hydrated` keeps the
	// list off the server markup until we're safely past that point.
	let hydrated = $state(false);
	// Sentinel meaning "nothing loaded yet"; the effect below fills it in. Reading
	// `data.game.appId` here directly would only capture the initial value.
	let loadedAppId = $state(0);

	$effect(() => {
		const appId = data.game.appId;
		if (hydrated && appId === loadedAppId) return;
		loadedAppId = appId;
		const prefs = loadPrefs(appId);
		filter = prefs.filter;
		typeFilter = prefs.typeFilter;
		gameSort = prefs.gameSort;
		hydrated = true;
	});

	$effect(() => {
		if (!browser || !hydrated) return;
		localStorage.setItem(`platworks:filter:${loadedAppId}`, filter);
		localStorage.setItem(`platworks:typeFilter:${loadedAppId}`, typeFilter);
		localStorage.setItem('platworks:gameSort', gameSort);
	});

	let completedCount = $derived(
		Object.values(achievedMap).filter(Boolean).length
	);

		// Rolls the headline figure up from zero once the list exists. Re-runs when the
		// player checks a trophy off mid-session, which is the intended behaviour: the
		// number visibly acknowledges the change rather than silently swapping.
		let progressNumberEl = $state<HTMLElement | null>(null);

		$effect(() => {
			const el = progressNumberEl;
			if (!hydrated || !el) return;
			countUp(el, completedCount);
		});

	let progressPercent = $derived(
		Math.round((completedCount / data.game.totalAchievements) * 100)
	);

	// Counts the sidebar reports and the filter chips label. Derived rather than
	// passed down so the sidebar, the chips and the segmented filter can never
	// disagree about how many of each exist.
	let missableCount = $derived(
		data.game.achievements.filter((a) => (a.types as string[]).includes('missable')).length
	);
	let lockedCount = $derived(data.game.totalAchievements - completedCount);

	/**
	 * Difficulty counts, ascending, with empty levels dropped.
	 *
	 * This is what the aside's segmented bar is built from — each segment's width is
	 * `total / totalAchievements`. It is deliberately NOT per-difficulty completion:
	 * the bar is a property of the game's DATA and does not move as you check trophies
	 * off, which is what separates it from the progress bar directly above it.
	 *
	 * Dropping empty levels matters: a game with no `very-hard` trophies must not
	 * render an 8px-minimum segment for a group that does not exist.
	 */
	const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'very-hard'] as const;

	let difficultyCounts = $derived.by(() =>
		DIFFICULTY_ORDER.map((level) => ({
			level,
			total: data.game.achievements.filter((a) => a.difficulty === level).length
		})).filter((d) => d.total > 0)
	);

	let difficultyMix = $derived(difficultyCounts.map((d) => d.total).join(' / '));

	/** One entry per difficulty, carrying the bar colour AND the pip colour. */
	const DIFFICULTY_TONE: Record<string, string> = {
		easy: 'var(--pw-difficulty-easy)',
		medium: 'var(--pw-difficulty-medium)',
		hard: 'var(--pw-difficulty-hard)',
		'very-hard': 'var(--pw-difficulty-very-hard)'
	};

	const difficultyOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2, 'very-hard': 3 };

	// Factored out because `visibleAchievements` re-sorts: a row held for its exit
	// has to land back where the active sort would put it, not at the end.
	function sortList(list: typeof data.game.achievements) {
		if (gameSort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
		if (gameSort === 'difficulty')
			return [...list].sort(
				(a, b) => (difficultyOrder[a.difficulty] ?? 0) - (difficultyOrder[b.difficulty] ?? 0)
			);
		return list;
	}

	/**
	 * Everything the search and the tag filter allow, BEFORE the completion filter.
	 *
	 * Split out because the completion filter is the only one a toggle can change, and a
	 * row it drops has to stay in `candidates` for `visibleAchievements` to put it back
	 * where it was.
	 */
	let candidates = $derived.by(() => {
		const q = trophyQuery.trim().toLowerCase();
		return data.game.achievements.filter((a) => {
			// Free-text search runs alongside the persisted filters, so "Leyndell" still
			// narrows a Locked-only list. `description` is optional in practice — some
			// generated data files omit it.
			if (q) {
				const haystack = `${a.name} ${a.description ?? ''}`.toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			// A trophy matches a tag filter if it carries that tag; 'standard' is the
			// inverse — it selects the untagged ones.
			if (typeFilter === 'standard') {
				if (a.types.length) return false;
			} else if (typeFilter !== 'all' && !(a.types as string[]).includes(typeFilter)) {
				return false;
			}
			return true;
		});
	});

	function passesCompletion(a: (typeof data.game.achievements)[number]): boolean {
		const achieved = achievedMap[a.id];
		if (filter === 'locked' && achieved) return false;
		if (filter === 'unlocked' && !achieved) return false;
		return true;
	}

	let filteredAchievements = $derived(sortList(candidates.filter(passesCompletion)));

	/**
	 * Rows a toggle has just pushed out of the active filter, held in the list until
	 * their exit animation reports back.
	 *
	 * Without this the keyed `{#each}` destroys the row in the same flush that applies
	 * `pw-celebrate`, so under a Locked or Done filter the trophy simply vanished:
	 * the celebration, and the collapse that explains the disappearance, were both
	 * painted on a node that no longer existed. A Set rather than a list because
	 * membership is tested once per row on every render of a 100-trophy game.
	 */
	let departing = $state<ReadonlySet<string>>(new Set());

	function depart(id: string) {
		if (departing.has(id)) return;
		departing = new Set(departing).add(id);
	}

	// Reassign rather than mutate: a `$state` Set is only reactive on reassignment,
	// so an in-place `.delete()` would leave the list rendering the old membership.
	function release(id: string) {
		if (!departing.has(id)) return;
		const next = new Set(departing);
		next.delete(id);
		departing = next;
	}

	/**
	 * `filteredAchievements` plus anything still animating out.
	 *
	 * Built by re-filtering `candidates` with the held ids let through — NOT by
	 * appending them. Appending is the trap: `sortList` is a no-op under the default
	 * sort, so `[...filtered, ...held]` puts the departing row LAST and the card the
	 * player just tapped teleports to the bottom of the list. Filtering `candidates`
	 * instead keeps it at the index the active sort gives it, so it collapses from
	 * where it was tapped. Same rule as the library page's scope switcher: nothing
	 * the player just touched may move out from under their finger.
	 */
	let visibleAchievements = $derived.by(() => {
		if (departing.size === 0) return filteredAchievements;
		const held = new Set(departing);
				return sortList(candidates.filter((a) => held.has(a.id) || passesCompletion(a)));
	});

	// A filter/sort/search change rebuilds the list wholesale, so a row mid-exit is
	// no longer the one the user was looking at. Release them all rather than let a
	// stale id pin a card that no longer belongs to this view.
	//
	// `untrack` on the guard is load-bearing, not defensive: this effect must depend on
	// the four controls ONLY. Reading `departing` here makes the effect re-run the
	// instant `depart()` fires, clearing the id in the same tick it was added — which
	// silently restores the original bug.
	$effect(() => {
		void filter;
		void typeFilter;
		void gameSort;
		void trophyQuery;
		if (untrack(() => departing.size)) departing = new Set();
	});

	// Tags are non-exclusive, so a trophy can appear under several filters at once.
		// 'standard' is a synthetic entry (not a real tag) offered only when the game
		// actually has untagged trophies, to select them.
		let achievementTypes = $derived.by((): string[] => {
			const tags = [...new Set<string>(data.game.achievements.flatMap((a) => a.types))].sort();
			if (data.game.achievements.some((a) => a.types.length === 0)) tags.push('standard');
			return tags;
		});

		// Per-tag totals for the filter chips. A chip with no count on it is a chip the
		// player taps and gets nothing from.
		let typeCounts = $derived.by((): Record<string, number> => {
			const counts: Record<string, number> = {};
			for (const a of data.game.achievements) {
				if (a.types.length === 0) counts.standard = (counts.standard ?? 0) + 1;
				for (const t of a.types) counts[t] = (counts[t] ?? 0) + 1;
			}
			return counts;
		});

	// Filter options are declared inline where `segmented_control.svelte` renders
	// them, with live counts — so the old `filterOptions` array is gone.

	// Built once here and handed to `game_filters.svelte`, so the counts cannot
	// drift from what the filter actually produces.
	let completionFilterOptions = $derived([
		{ value: 'all', label: 'All', count: data.game.totalAchievements },
		{ value: 'locked', label: 'Locked', icon: Lock, count: lockedCount },
		{ value: 'unlocked', label: 'Done', icon: Unlock, count: completedCount }
	]);
</script>

<svelte:head>
	<title>{data.steam?.name || data.game.name} — PlatWorks</title>
</svelte:head>

<div class="relative min-h-screen">
	<!-- Fixed background layer. Using `position: fixed` (instead of bg-fixed on a
	     full-page element) plus a plain overlay keeps the visual result while
	     avoiding a full-viewport repaint on every scroll frame. -->
	<!--
		Steam's page background is gone. It rendered behind a 90% `bg-steam-dark`
		scrim, so a tenth of it was visible, and the real files run to 1.6 MB each —
		17 MB of repo for something that could not be seen. Removing it also drops
		a full-viewport image request from every game page load.
	-->
	<div class="relative z-10">
		<!--
			Two-pane on desktop, one column below `lg`.

			`max-w-4xl` used to cap the whole page, which is a narrow ribbon on a 1440px
			display — the widest possible waste of a screen built for wide screens. The
			sidebar is a fixed 288px and the list takes the rest, which keeps the guide
			prose that expands inside each row comfortably inside a readable measure
			while the progress summary stays on screen while you scroll 200 trophies.
					-->
			<div class="mx-auto max-w-[1400px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6 sm:pt-6 lg:grid lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-6 lg:px-8 lg:pb-16">
			<!--
				Sticky on desktop only. Below `lg` it is the first block in the flow, so
				`position: sticky` would pin a tall hero to the top of the scroll and
				leave almost no room for the list.
			-->
			<!--
				THE RAIL.

				Four `rounded-*` boxes stacked with equal gaps used to live here — hero,
				badge row, a bordered progress panel, and three `border-t` stat rows
				inside it. Nothing was wrong with any one of them; the STACK was the
				problem, because a grid of rounded rectangles each with its own fill and
				border is exactly what a tablet settings panel looks like.

				So this column now has NO surface of its own. Nothing below carries a
				background or a border except the artwork and the buttons, and the
				structure is carried by type, two hairlines and the vertical rhythm
				instead. The hierarchy is the gaps: `gap-2` inside the identity block
				where things belong together, `gap-3`/`gap-4` between the sections.

				Not a responsive restyle either — this is the same composition at 390,
				where the column is simply the first block in the flow instead of a
				sidebar.
			-->
			<aside class="flex flex-col gap-3 lg:sticky lg:top-[4.5rem] lg:self-start lg:gap-4">
			<!-- Back link (desktop only — mobile uses navbar back arrow + bottom bar home) -->
			<a
				href="/"
				class="-ml-1 hidden h-10 items-center gap-1.5 self-start rounded-lg px-2 text-sm text-ink-dim hover:text-steam-accent lg:inline-flex"
			>
				<ArrowLeft class="h-4 w-4" />
				Games
			</a>

			<!-- Game hero, as a MASTHEAD BAND rather than a tile.

			     `aspect-[2/1]` below `lg` and `lg:aspect-[16/7]`: thin enough to read as
			     a rule under the navbar rather than as a picture panel. Square corners at
			     every breakpoint, so it is an image bleeding to the column edge and not a
			     card sitting on the page.

			     The artwork still carries NO overlay text, for the same reason as before:
			     an absolutely positioned block inside a fixed-ratio box is the one layout
			     that cannot grow, and a 300-character Steam blurb escapes it. See §1 of
			     .agents/ui.md. -->
			<div class="relative aspect-[2/1] overflow-hidden bg-steam-blue lg:aspect-[16/7]">
							<!--
								`pw-game-art` is the DESTINATION half of the library card's shared
								element. The library sets the same name on the artwork of the card
								being activated, so the browser morphs that rectangle into this one
								instead of cross-fading the whole page.

								Only one element may carry the name at a time or the transition is
								aborted, and this page renders exactly one hero, so the destination is
								safe. The library is the constrained side — see `game_card.svelte`.

								`+layout.svelte` clears the source name after the swap, so coming
								back to the library does not find two elements still named.
							-->
							<div class="absolute inset-0" style:view-transition-name="'pw-game-art'"></div>
							<!-- Same placeholder-behind-the-image contract as `game_card.svelte`:
							     a game with no Steam banner must show something intentional, not an
							     empty surface. See the note there for the two affected appIds. -->
							<div
								class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-steam-blue to-steam-light"
								aria-hidden="true"
							>
								<Trophy class="h-10 w-10 text-ink-faint" />
							</div>
				{#if heroImage}
					<!-- Decorative: the game name is the h1 below it, so a non-empty alt would
					     only make a screen reader announce the title twice. `high` because this
					     image is the page's LCP.

					     `onerror` hides the img and lets the placeholder show. There is no
					     remote retry: artwork is local, so a failure means the game has no
					     hero on Steam, not that the first CDN path was wrong. -->
					<img
						src={heroImage}
						alt=""
						fetchpriority="high"
						class="absolute inset-0 h-full w-full object-cover"
						onerror={(e) => {
							(e.currentTarget as HTMLImageElement).style.display = 'none';
						}}
					/>
				{/if}
				<!-- A single bottom scrim. There is no overlay text left to protect, so
				     this is purely the blend from the artwork into the page — one pass,
				     not the two the hero used to need. -->
				<div class="absolute inset-0 bg-gradient-to-t from-steam-dark/85 to-transparent" aria-hidden="true"></div>
			</div>

			<!-- IDENTITY — one block, tight gaps. Title, facts, blurb belong together. -->
			<div class="flex flex-col gap-2">
				<h1 class="font-display text-[22px] font-bold leading-[1.1] tracking-[-0.03em] text-ink lg:text-[27px]">
					{data.steam?.name || data.game.name}
				</h1>

				<div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-ink-dim">
					{#if data.steam?.metacriticScore}
						<span class="tabular inline-flex items-center gap-1 rounded-md bg-steam-light px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink">
							<Star class="h-3 w-3 fill-current text-yellow-400" />
							{data.steam.metacriticScore}
						</span>
					{/if}
					<span class="tabular">
						{data.game.totalAchievements} trophies{#if missableCount}&middot; {missableCount} missable{/if}
					</span>
				</div>

				<!-- Clamped to three lines at EVERY breakpoint: the column is 288px and
				     Steam's longer blurbs run 300+ characters. The full text stays on
				     the store page, linked from the map row below. -->
				{#if data.steam?.shortDescription}
					<p class="line-clamp-3 text-[13px] leading-relaxed text-ink-dim">
						{data.steam.shortDescription}
					</p>
				{/if}
			</div>

			<div class="h-px bg-line"></div>

			<!--
				PROGRESS — the headline, then the two bars.

				The percentage is now a 44px figure rather than an 11px label inside a
				54px ring, because in a column with no surfaces the size of the type IS
				the hierarchy. The ring is gone from THIS column — it survives at 38px in
				`mobile_bar.svelte`, so nothing is orphaned and a phone sees no change
				here at all, because the mobile bar's ring is what a phone actually shows.

				The count beside it is the app's count-up, `bind:this` + `#lib/client/
				countup.ts`, gated on `hydrated`: completion lives in localStorage, so
				before the gate the server has no number and there is nothing to roll.
			-->
			<div>
				<div class="flex items-baseline gap-2.5">
					<span class="font-display text-[38px] font-bold leading-[0.9] tracking-[-0.04em] text-steam-accent lg:text-[44px]">
						{progressPercent}%
					</span>
					<span class="tabular font-mono text-[13px] text-ink-dim">
						{#if hydrated}
							<span bind:this={progressNumberEl}>{completedCount}</span>
						{:else}
							0
						{/if}
						of {data.game.totalAchievements} unlocked
					</span>
				</div>

				<!-- BAR 1 of 2 · PROGRESS. Moves when you check a trophy off. -->
				<div class="mt-3.5">
					<div class="mb-1.5 flex items-baseline justify-between text-[9px] font-bold uppercase tracking-[0.11em] text-ink-faint">
						<span>Progress</span>
						<span class="font-mono text-[10px] normal-case tracking-normal">{completedCount} / {data.game.totalAchievements}</span>
					</div>
					<ProgressBar percent={progressPercent} height={6} />
				</div>

				<!-- BAR 2 of 2 · DIFFICULTY MIX. A composition of the whole game, so it
				     deliberately does NOT move as you check trophies off. Each bar carries
				     a visible NAME: two unlabelled 6px bars 16px apart would read as one
				     fussy bar rather than as a chart. See the `.pw-diff-bar` block in
				     `app.css` for why the separator is drawn outside each segment. -->
				<div class="mt-4">
					<div class="mb-1.5 flex items-baseline justify-between text-[9px] font-bold uppercase tracking-[0.11em] text-ink-faint">
						<span>Difficulty mix</span>
						<span class="font-mono text-[10px] normal-case tracking-normal">{difficultyMix}</span>
					</div>
					<div
						class="pw-diff-bar"
						role="img"
						aria-label="Difficulty mix: {difficultyCounts.map((d) => `${d.total} ${d.level}`).join(', ')}"
					>
						{#each difficultyCounts as d (d.level)}
							<i
								style:--pw-w="{(d.total / data.game.totalAchievements) * 100}%"
								style:background={DIFFICULTY_TONE[d.level]}
							></i>
						{/each}
					</div>

					<!-- Never colour alone: a named label and a number beside every swatch. -->
					<div class="mt-2.5 grid grid-cols-2 gap-x-2.5 gap-y-1.5">
						{#each difficultyCounts as d (d.level)}
							<div class="flex items-center gap-1.5 text-[11px]">
								<span class="h-2 w-2 shrink-0 rounded-[2px]" style:background={DIFFICULTY_TONE[d.level]} aria-hidden="true"></span>
								<span class="capitalize text-ink-dim">{d.level.replace('-', ' ')}</span>
								<span class="tabular font-mono font-bold">{d.total}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="h-px bg-line"></div>

			<!-- Two plain figures on one line. These were three 40px rows, each with its
			     own `border-t`, inside a panel — 120px of column for three numbers. -->
			<dl class="flex gap-5">
				<div>
					<dt class="text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">Remaining</dt>
					<dd class="tabular mt-0.5 font-mono text-[17px] font-bold text-ink">{lockedCount}</dd>
				</div>
				<div>
					<dt class="text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">Missable</dt>
					<dd class="tabular mt-0.5 font-mono text-[17px] font-bold" style:color={DIFFICULTY_TONE['very-hard']}>{missableCount}</dd>
				</div>
			</dl>

			<!--
				Sync is hidden below `sm` because the mobile bar already carries it —
				two sync buttons would be the same duplication as the filters. The map
				link stays at every width: nothing else offers it, so hiding it on a
				phone would make it unreachable.
			-->
			<div class="flex flex-col gap-2">
				<div class="hidden sm:block">
					<ActionButton label="Sync with Steam" icon={RefreshCw} onclick={syncWithSteam} loading={syncing} full />
				</div>
				{#if data.game.mapUrl}
					<a
						href={data.game.mapUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-steam-blue"
					>
						<MapPinned class="h-4 w-4 shrink-0" />
						Interactive map
					</a>
				{/if}

				<!-- The "no Steam ID" state is a note ON the sync control rather than a
				     chip of its own higher up the column: it is a state of that control,
				     so it belongs beside it. -->
				{#if !steamId}
					<p class="flex items-center gap-1.5 text-[11px] text-yellow-300">
						<WifiOff class="h-3.5 w-3.5 shrink-0" />
						No Steam ID set — syncing is unavailable
					</p>
				{/if}
				{#if syncError}
					<p class="text-xs text-red-400">{syncError}</p>
				{/if}
				{#if syncSuccess}
					<p class="text-xs text-steam-green">{syncSuccess}</p>
				{/if}
			</div>
			</aside>

			<section class="min-w-0">
			<!--
				Filters, rendered ONCE for every breakpoint — see `game_filters.svelte`.

				`mt-4 lg:mt-0` is the gap between the sidebar and this column when they
				stack on a phone. The container is only a grid at `lg`, so below that
				the two are plain block siblings and the aside's own `gap-3` cannot
				separate them — without this the toolbar touched the stats panel. At `lg`
				they are side-by-side columns and the margin would just push the toolbar
				out of alignment with the top of the sidebar, so it goes to zero.

							`pw-quiet` is the background pattern's quiet band: a flat `--pw-bg` layer
							so the tile stops behind the control row. It bleeds to the 1400px
							container edge, not the viewport, because the container is centred and
							max-width'd here.
						-->
						<div class="pw-quiet mt-4 lg:mt-0">
							<GameFilters
								bind:filter
								bind:typeFilter
								bind:gameSort
								bind:query={trophyQuery}
								completionFilterOptions={completionFilterOptions}
								types={achievementTypes}
								typeCounts={typeCounts}
							/>
						</div>

			<!-- Achievement list -->
			<div class="mt-3 flex flex-col gap-2">
				{#if !hydrated}
									<!--
										SHAPED skeleton. The old rows were flat `h-[90px]` rectangles,
										which happened to match the collapsed card's height but gave the
										list no internal structure — so it read as "broken" rather than
										"loading", and the eye had nothing to land on. This is the real
										silhouette: a 64x64 trophy square, a title line, two description
										lines and the meta rail. Same 90px collapsed height, so the
										`contain-intrinsic-size` estimate in `app.css` still holds.
									-->
									{#each Array(Math.min(data.game.achievements.length, 12)) as _, i (i)}
										<div class="pw-skeleton flex items-center gap-2 p-2 sm:gap-3 sm:p-3">
											<div class="pw-skeleton-fill h-16 w-16 shrink-0"></div>
											<div class="min-w-0 flex-1 space-y-2">
												<div class="pw-skeleton-fill h-3.5 w-2/5"></div>
												<div class="pw-skeleton-fill h-2.5 w-11/12"></div>
												<div class="pw-skeleton-fill h-2.5 w-7/12"></div>
											</div>
										</div>
									{/each}
				{:else}
					{#each visibleAchievements as achievement (achievement.id)}
						<AchievementRow
							{achievement}
							achieved={achievedMap[achievement.id]}
							steamLocked={false}
							unlockTime={null}
												exiting={departing.has(achievement.id)}
												celebration={celebrations[achievement.id] ?? 0}
												ontoggle={() => toggleCheck(achievement.id)}
												onvanished={() => release(achievement.id)}
											/>
										{/each}

										<!--
											Gated on `visibleAchievements`, not `filteredAchievements`: a row
											held for its exit animation is still on screen, so the empty state
											must wait for it rather than appearing underneath a card that is
											still collapsing.
										-->
										{#if visibleAchievements.length === 0}
						<div class="py-16 text-center">
							<p class="text-ink-dim">No achievements match these filters.</p>
							<div class="mt-3 flex justify-center">
								<ActionButton
									label="Reset filters"
									variant="secondary"
									onclick={() => {
										filter = 'all';
										typeFilter = 'all';
										trophyQuery = '';
									}}
								/>
							</div>
						</div>
					{/if}
				{/if}
			</div>
			</section>
		</div>
	</div>
	</div>

<!--
	Mobile bottom bar.

	Deliberately passes NO `panel` snippet. The filters live once, in the page,
	rendered by `game_filters.svelte` at every breakpoint — a second copy inside
	this bar is what had "Filter by type" rendered twice on a phone. The bar
	carries progress, search and sync, and nothing else.
-->
<MobileBar
	percent={progressPercent}
	primary="{completedCount}/{data.game.totalAchievements}"
	secondary="{filteredAchievements.length} shown"
	status={syncError ?? syncSuccess}
	statusTone={syncError ? 'error' : 'ok'}
	syncing={syncing}
	onsync={syncWithSteam}
	searchPlaceholder="Search trophies…"
	searchLabel="Search trophies"
	bind:query={trophyQuery}
/>