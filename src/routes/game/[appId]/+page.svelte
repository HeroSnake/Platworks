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
	import ProgressRing from '#lib/components/progress_ring.svelte';
	import ProgressBar from '#lib/components/progress_bar.svelte';
	import ActionButton from '#lib/components/action_button.svelte';
	import { browser } from '$app/env';
	import { refreshProfile } from '#lib/client/profile';

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

	function toggleCheck(id: string) {
		localChecked[id] = !localChecked[id];
		saveLocal();
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
			let count = 0;
			for (const a of data.game.achievements) {
				const key = a.name.toLowerCase().replace(/["'\u2018\u2019\u201c\u201d\u00ab\u00bb`]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
				const steamEntry = steamMap[key];
				if (steamEntry?.achieved && !localChecked[a.id]) {
					localChecked[a.id] = true;
					count++;
				}
			}
			saveLocal();
			syncSuccess = count > 0 ? `Synced ${count} achievement${count > 1 ? 's' : ''}` : 'Already up to date';
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
	let difficultyMix = $derived.by(() => {
		const order = ['easy', 'medium', 'hard', 'very-hard'] as const;
		const counts = order.map((lv) => data.game.achievements.filter((a) => a.difficulty === lv).length);
		return counts.join(' / ');
	});

	const difficultyOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2, 'very-hard': 3 };

	let filteredAchievements = $derived.by(() => {
		const q = trophyQuery.trim().toLowerCase();
		const list = data.game.achievements.filter((a) => {
			// Free-text search runs alongside the persisted filters, so "Leyndell" still
			// narrows a Locked-only list. `description` is optional in practice — some
			// generated data files omit it.
			if (q) {
				const haystack = `${a.name} ${a.description ?? ''}`.toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			const achieved = achievedMap[a.id];
			if (filter === 'locked' && achieved) return false;
			if (filter === 'unlocked' && !achieved) return false;
			// A trophy matches a tag filter if it carries that tag; 'standard' is the
						// inverse — it selects the untagged ones.
						if (typeFilter === 'standard') {
							if (a.types.length) return false;
						} else if (typeFilter !== 'all' && !(a.types as string[]).includes(typeFilter)) {
							return false;
						}
						return true;
		});
		if (gameSort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
		if (gameSort === 'difficulty') return [...list].sort((a, b) => (difficultyOrder[a.difficulty] ?? 0) - (difficultyOrder[b.difficulty] ?? 0));
		return list;
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
		<div class="mx-auto max-w-[1400px] px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:grid lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-6 lg:px-8 lg:pb-16">
			<!--
				Sticky on desktop only. Below `lg` it is the first block in the flow, so
				`position: sticky` would pin a tall hero to the top of the scroll and
				leave almost no room for the list.
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

			<!-- Game hero. Short and wide below `lg` (21:9) so the checklist starts in
			     the first screenful; full 16:9 once there is room beside it.

			     The artwork carries NO text. The name and description sit below it in
			     normal flow instead of being overlaid, because an absolutely
			     positioned block inside a fixed-ratio box is the one layout that
			     cannot grow: a Steam blurb longer than the box escapes it, overlaps
			     the artwork and spills out of the 288px sidebar. See §1 of
			     platworks-ui.agent.md. -->
			<div class="relative aspect-[21/9] overflow-hidden rounded-xl bg-steam-blue lg:aspect-video">
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
			</div>

			<!-- Picture → name → description, as one block, in the flow. -->
			<div>
				<h1 class="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
					{data.steam?.name || data.game.name}
				</h1>

				<!-- Clamped everywhere, not just on phones: the sidebar is 288px and
				     Steam's longer blurbs run 300+ characters. Full text stays on the
				     store page, linked from the map row. -->
				{#if data.steam?.shortDescription}
					<p class="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-ink-dim">
						{data.steam.shortDescription}
					</p>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#if data.steam?.metacriticScore}
					<span class="tabular inline-flex min-h-8 items-center gap-1 rounded-md bg-steam-light px-2 py-1 font-mono text-xs font-bold text-ink">
						<Star class="h-3.5 w-3.5 fill-current text-yellow-400" />
						{data.steam.metacriticScore}
					</span>
				{/if}
				{#if !steamId}
					<span class="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-yellow-500/25 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300">
						<WifiOff class="h-3.5 w-3.5 shrink-0" />
						<span class="hidden sm:inline">Set your Steam ID to sync</span>
						<span class="sm:hidden">No Steam ID</span>
					</span>
				{/if}
			</div>

			<!--
				Trophy information belongs in the LEFT column, under picture → name →
				description. It was previously the first block of the right column, which
				meant the two things you read first — which game this is, and how far
				through it you are — were in opposite columns with a 200-trophy list
				between nothing and them.
			-->
			<div class="rounded-xl border border-line bg-steam-blue p-3.5">
				<div class="flex items-center gap-3.5">
					<ProgressRing percent={progressPercent} size={54} fontSize={11.5} strokeWidth={4} />
					<div class="min-w-0 flex-1">
						<p class="tabular font-mono text-lg font-bold leading-none tracking-tight text-ink">
							{completedCount} / {data.game.totalAchievements}
						</p>
						<p class="mt-1 text-xs text-ink-faint">trophies unlocked</p>
						<div class="mt-2">
							<ProgressBar percent={progressPercent} height={6} />
						</div>
					</div>
				</div>

				<div class="mt-3 flex items-center justify-between border-t border-line py-2 text-sm">
					<span class="text-ink-dim">Remaining</span>
					<span class="tabular font-mono font-bold text-ink">{data.game.totalAchievements - completedCount}</span>
				</div>
				<div class="flex items-center justify-between border-t border-line py-2 text-sm">
					<span class="text-ink-dim">Missable</span>
					<span class="tabular font-mono font-bold text-yellow-400">{missableCount}</span>
				</div>
				<div class="flex items-center justify-between border-t border-line py-2 text-sm">
					<span class="text-ink-dim">Difficulty mix</span>
					<span class="tabular font-mono font-bold text-ink">{difficultyMix}</span>
				</div>

				<!--
					Sync is hidden below `sm` because the mobile bar already carries it —
					two sync buttons would be the same duplication as the filters. The map
					link stays at every width: nothing else offers it, so hiding it on a
					phone would make it unreachable.
				-->
				<div class="mt-3 flex flex-col gap-2">
					<div class="hidden sm:block">
						<ActionButton label="Sync with Steam" icon={RefreshCw} onclick={syncWithSteam} loading={syncing} full />
					</div>
					{#if data.game.mapUrl}
						<a
							href={data.game.mapUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-steam-blue text-sm font-medium text-ink hover:bg-steam-light"
						>
							<MapPinned class="h-4 w-4 shrink-0" />
							Interactive map
						</a>
					{/if}
				</div>

				{#if syncError}
					<p class="mt-2 text-xs text-red-400">{syncError}</p>
				{/if}
				{#if syncSuccess}
					<p class="mt-2 text-xs text-steam-green">{syncSuccess}</p>
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
					{#each Array(Math.min(data.game.achievements.length, 12)) as _, i (i)}
						<div class="h-[90px] animate-pulse rounded-xl bg-steam-blue"></div>
					{/each}
				{:else}
					{#each filteredAchievements as achievement (achievement.id)}
						<AchievementRow
							{achievement}
							achieved={achievedMap[achievement.id]}
							steamLocked={false}
							unlockTime={null}
							ontoggle={() => toggleCheck(achievement.id)}
						/>
					{/each}

					{#if filteredAchievements.length === 0}
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