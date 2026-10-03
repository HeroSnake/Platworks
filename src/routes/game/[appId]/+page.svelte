<script lang="ts">
	import {
		ArrowLeft,
		Trophy,
		WifiOff,
		Star,
		Lock,
		Unlock,
		Search,
		RefreshCw,
		Loader2,
		MapPinned
	} from '@lucide/svelte';
	import AchievementRow from '#lib/components/achievement_row.svelte';
	import MobileBar from '#lib/components/mobile_bar.svelte';
	import { browser } from '$app/env';
	import { refreshProfile } from '#lib/client/profile';

	let { data } = $props();

	let storageKey = $derived(`platworks:checked:${data.game.appId}`);

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
	// per game because every game exposes its own set of achievement types.
	let filter = $state<FilterValue>('all');
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
			// Drop a stored type the game no longer defines (data files get regenerated).
			const types = new Set<string>(data.game.achievements.map((a) => a.type));
			return {
				filter: f === 'locked' || f === 'unlocked' ? f : 'all',
				typeFilter: t && t !== 'all' && types.has(t) ? t : 'all',
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

	// Matches game_card.svelte: the bar switches to the same green the library grid
	// uses for "Complete". Keyed off the displayed percentage so the colour always
	// agrees with the number shown next to it.
	let isComplete = $derived(progressPercent === 100);

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
			if (typeFilter !== 'all' && a.type !== typeFilter) return false;
			return true;
		});
		if (gameSort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
		if (gameSort === 'difficulty') return [...list].sort((a, b) => (difficultyOrder[a.difficulty] ?? 0) - (difficultyOrder[b.difficulty] ?? 0));
		return list;
	});

	let achievementTypes = $derived([...new Set(data.game.achievements.map((a) => a.type))]);

	const filterOptions: Array<{ value: typeof filter; label: string; icon: typeof Trophy }> = [
		{ value: 'all', label: 'All', icon: Trophy },
		{ value: 'locked', label: 'Locked', icon: Lock },
		{ value: 'unlocked', label: 'Done', icon: Unlock }
	];
</script>

<svelte:head>
	<title>{data.steam?.name ?? data.game.name} — PlatWorks</title>
</svelte:head>

<div class="relative min-h-screen">
	<!-- Fixed background layer. Using `position: fixed` (instead of bg-fixed on a
	     full-page element) plus a plain overlay keeps the visual result while
	     avoiding a full-viewport repaint on every scroll frame. -->
	<div class="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
		{#if data.steam?.background}
			<div class="absolute inset-0 bg-cover bg-center bg-no-repeat"
				style:background-image="url({data.steam.background})"
			></div>
		{/if}
		<div class="absolute inset-0 bg-steam-dark/90"></div>
	</div>

	<div class="relative z-10">
		<div class="mx-auto max-w-4xl px-4 pb-16 pt-4 sm:pt-8">
			<!-- Back link (desktop only — mobile uses navbar back arrow + bottom bar home) -->
			<a href="/" class="mb-6 hidden items-center gap-1.5 text-sm text-gray-400 hover:text-steam-accent sm:inline-flex">
				<ArrowLeft class="h-4 w-4" />
				Games
			</a>

			<!-- Game header -->
			<div class="mb-6 sm:mb-8">
				{#if data.steam?.headerImage}
					<img
						src={data.steam.headerImage}
						alt={data.game.name}
						class="mb-4 w-full rounded-xl shadow-lg sm:mb-6 sm:max-w-sm"
					/>
				{/if}

				<h1 class="text-2xl font-bold sm:text-3xl">{data.steam?.name ?? data.game.name}</h1>

				{#if data.steam?.shortDescription}
					<p class="mt-2 text-sm text-gray-400 sm:text-base">{data.steam.shortDescription}</p>
				{/if}

				<div class="mt-3 flex flex-wrap items-center gap-2">
					{#if data.game.mapUrl}
						<!-- A link, so it gets a real 40px tap target on phones. The
						     neighbouring Metacritic chip is a plain span and can stay compact. -->
						<a
							href={data.game.mapUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex min-h-10 items-center gap-1.5 rounded bg-steam-light px-3 text-xs text-gray-200 active:bg-steam-accent/80 sm:min-h-8 sm:px-2.5 sm:py-1 sm:text-sm"
						>
							<MapPinned class="h-3.5 w-3.5 shrink-0" />
							Interactive Map
						</a>
					{/if}
					{#if data.steam?.metacriticScore}
						<span class="flex items-center gap-1 rounded bg-steam-green px-2 py-1 text-xs font-bold sm:text-sm">
							<Star class="h-3.5 w-3.5" />
							{data.steam.metacriticScore}
						</span>
					{/if}

					{#if !steamId}
						<span class="flex items-center gap-1.5 rounded bg-yellow-900/50 px-2 py-1 text-xs text-yellow-300">
							<WifiOff class="h-3.5 w-3.5" />
							<span class="hidden sm:inline">Set your Steam ID to sync (top right)</span>
							<span class="sm:hidden">No Steam ID</span>
						</span>
					{/if}
				</div>

				<!-- Progress -->
				<div class="mt-5">
					<div class="mb-1.5 flex items-center justify-between text-sm">
						<span class="flex items-center gap-1.5 font-medium">
							<Trophy class="h-4 w-4 text-steam-accent" />
							{completedCount} / {data.game.totalAchievements}
						</span>
						<span class="tabular-nums {isComplete ? 'text-green-400' : 'text-gray-400'}">{progressPercent}%</span>
					</div>
					<div class="h-3 overflow-hidden rounded-full bg-steam-light">
						<div
							class="h-full w-full origin-left rounded-full transition-transform duration-500 ease-out {isComplete
								? 'bg-gradient-to-r from-green-400 to-green-300'
								: 'bg-gradient-to-r from-steam-accent to-blue-400'}"
							style:transform="scaleX({progressPercent / 100})"
						></div>
					</div>
				</div>

				<!-- Sync section (desktop only) -->
				<div class="mt-4 hidden flex-wrap items-center gap-3 sm:flex">
					<button
						class="inline-flex items-center gap-2 rounded-lg bg-steam-accent px-4 py-2 text-sm font-semibold text-steam-dark transition-colors hover:bg-steam-accent/90 disabled:opacity-50"
						onclick={syncWithSteam}
						disabled={syncing}
					>
						{#if syncing}
							<Loader2 class="h-4 w-4 animate-spin" />
							Syncing...
						{:else}
							<RefreshCw class="h-4 w-4" />
							Sync
						{/if}
					</button>
					{#if syncError}
						<span class="text-xs text-red-400">{syncError}</span>
					{/if}
					{#if syncSuccess}
						<span class="text-xs text-green-400">{syncSuccess}</span>
					{/if}
				</div>
			</div>

			<!-- Filters (desktop only — mobile uses bottom bar) -->
			<div class="mb-6 hidden sm:block">
				<div class="flex flex-wrap items-center gap-2 sm:gap-3">
					<div class="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-steam-blue px-3 py-2">
						<Search class="h-4 w-4 shrink-0 text-gray-500" />
						<input
							type="text"
							placeholder="Search trophies..."
							class="min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
							bind:value={trophyQuery}
						/>
					</div>

					<div class="flex rounded-lg bg-steam-blue p-0.5 text-sm sm:p-1">
						{#each filterOptions as opt}
							<button
								class="flex items-center gap-1.5 rounded-md px-3 py-2 transition-colors sm:py-1.5 {filter === opt.value ? 'bg-steam-accent text-steam-dark font-semibold' : 'text-gray-400 hover:text-gray-200'}"
								onclick={() => filter = opt.value}
							>
								<opt.icon class="h-3.5 w-3.5 sm:hidden" />
								{opt.label}
							</button>
						{/each}
					</div>

					<select
						class="min-w-0 rounded-lg border-none bg-steam-blue px-3 py-2 text-sm text-gray-300 outline-none"
						bind:value={typeFilter}
					>
						<option value="all">All types</option>
						{#each achievementTypes as t}
							<option value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
						{/each}
					</select>

					<select
						class="shrink-0 rounded-lg border-none bg-steam-blue px-3 py-2 text-sm text-gray-300 outline-none"
						bind:value={gameSort}
					>
						<option value="default">Default</option>
						<option value="name">A–Z</option>
						<option value="difficulty">Difficulty</option>
					</select>

					<span class="hidden text-sm text-gray-500 sm:block">
						{filteredAchievements.length} shown
					</span>
				</div>
			</div>

			<!-- Achievement list -->
			<div class="flex flex-col gap-2 pb-20 sm:pb-0">
				{#if !hydrated}
					{#each Array(Math.min(data.game.achievements.length, 12)) as _, i (i)}
						<div class="h-16 animate-pulse rounded-lg bg-steam-blue"></div>
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
						<p class="py-16 text-center text-gray-500">No achievements match filters.</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Mobile bottom bar -->
<MobileBar
	percent={progressPercent}
	primary="{completedCount}/{data.game.totalAchievements}"
	secondary="{filteredAchievements.length} shown"
	status={syncError ?? syncSuccess}
	statusTone={syncError ? 'error' : 'ok'}
	syncing={syncing}
	onsync={syncWithSteam}
	searchPlaceholder="Search trophies..."
	bind:query={trophyQuery}
>
	{#snippet panel()}
		<div class="flex items-center gap-2">
			<div class="flex rounded-lg bg-steam-blue p-0.5 text-sm">
				{#each filterOptions as opt}
					<button
						class="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs {filter === opt.value ? 'bg-steam-accent text-steam-dark font-semibold' : 'text-gray-400'}"
						onclick={() => filter = opt.value}
					>
						{opt.label}
					</button>
				{/each}
			</div>
			<select
				class="min-w-0 flex-1 rounded-lg border-none bg-steam-blue px-2 py-1.5 text-xs text-gray-300 outline-none"
				bind:value={typeFilter}
			>
				<option value="all">All types</option>
				{#each achievementTypes as t}
					<option value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
				{/each}
			</select>
			<select
				class="shrink-0 rounded-lg border-none bg-steam-blue px-2 py-1.5 text-xs text-gray-300 outline-none"
				bind:value={gameSort}
			>
				<option value="default">Default</option>
				<option value="name">A–Z</option>
				<option value="difficulty">Difficulty</option>
			</select>
		</div>
	{/snippet}
</MobileBar>
