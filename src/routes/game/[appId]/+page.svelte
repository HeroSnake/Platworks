<script lang="ts">
	import {
		ArrowLeft,
		Trophy,
		WifiOff,
		Star,
		Lock,
		Unlock,
		RefreshCw,
		Loader2,
		ArrowUp,
		Home,
		Filter,
	} from '@lucide/svelte';
	import AchievementRow from '$lib/components/achievement_row.svelte';
	import { browser } from '$app/environment';

	let { data } = $props();

	let storageKey = $derived(`platworks:checked:${data.game.appId}`);

	let localChecked = $state<Record<string, boolean>>(loadLocal());
	let syncing = $state(false);
	let syncError = $state<string | null>(null);
	let syncSuccess = $state<string | null>(null);
	let showFilters = $state(false);

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

	function getSteamId(): string {
		if (!browser) return '';
		return localStorage.getItem('platworks:steamId') ?? '';
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
		const sid = getSteamId();
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
			setTimeout(() => syncSuccess = null, 3000);
		} catch {
			syncError = 'Failed to connect to Steam';
		} finally {
			syncing = false;
		}
	}

	// Sort persisted to localStorage, filter only in component state (resets on new visit)
	let filter = $state<'all' | 'locked' | 'unlocked'>('all');
	let typeFilter = $state<string>('all');
	let gameSort = $state<'default' | 'difficulty' | 'name'>(loadGameSort());

	function loadGameSort(): 'default' | 'difficulty' | 'name' {
		if (!browser) return 'default';
		const v = localStorage.getItem('platworks:gameSort');
		if (v === 'difficulty' || v === 'name') return v;
		return 'default';
	}

	$effect(() => {
		if (browser) localStorage.setItem('platworks:gameSort', gameSort);
	});

	let completedCount = $derived(
		Object.values(achievedMap).filter(Boolean).length
	);

	let progressPercent = $derived(
		Math.round((completedCount / data.game.totalAchievements) * 100)
	);

	const difficultyOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2, 'very-hard': 3 };

	let filteredAchievements = $derived.by(() => {
		const list = data.game.achievements.filter((a) => {
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

<div class="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
	style:background-image={data.steam?.background ? `url(${data.steam.background})` : 'none'}
>
	<div class="min-h-screen bg-steam-dark/90 backdrop-blur-sm bg-fixed">
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
					{#if data.steam?.metacriticScore}
						<span class="flex items-center gap-1 rounded bg-steam-green px-2 py-1 text-xs font-bold sm:text-sm">
							<Star class="h-3.5 w-3.5" />
							{data.steam.metacriticScore}
						</span>
					{/if}

					{#if !getSteamId()}
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
						<span class="tabular-nums text-gray-400">{progressPercent}%</span>
					</div>
					<div class="h-3 overflow-hidden rounded-full bg-steam-light">
						<div
							class="h-full rounded-full bg-gradient-to-r from-steam-accent to-blue-400 transition-all duration-500"
							style:width="{progressPercent}%"
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
				<div class="flex items-center gap-2 sm:gap-3">
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
			</div>
		</div>
	</div>
</div>

<!-- Mobile bottom bar -->
<div class="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-steam-dark/95 backdrop-blur-md sm:hidden">
	{#if showFilters}
		<div class="border-b border-white/5 px-4 py-2.5">
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
		</div>
	{/if}

	{#if syncSuccess}
		<div class="border-b border-white/5 px-4 py-1.5 text-center text-xs text-green-400">
			{syncSuccess}
		</div>
	{/if}

	{#if syncError}
		<div class="border-b border-white/5 px-4 py-1.5 text-center text-xs text-red-400">
			{syncError}
		</div>
	{/if}

	<div class="flex items-center gap-2 px-4 py-2.5">
		<div class="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
			<div class="relative h-9 w-9 shrink-0">
				<svg class="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
					<circle cx="18" cy="18" r="15.5" fill="none" stroke-width="3" class="stroke-steam-light" />
					<circle
						cx="18" cy="18" r="15.5" fill="none" stroke-width="3"
						stroke-dasharray={`${progressPercent * 0.974} 100`}
						stroke-linecap="round"
						class="stroke-steam-accent transition-all duration-500"
					/>
				</svg>
				<span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">
					{progressPercent}%
				</span>
			</div>
			<div class="min-w-0 overflow-hidden text-xs leading-tight">
				<span class="font-semibold text-gray-200">{completedCount}/{data.game.totalAchievements}</span>
				<span class="block text-gray-500">{filteredAchievements.length} shown</span>
			</div>
		</div>

		<a href="/" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-steam-blue text-gray-400 active:text-white">
			<Home class="h-4 w-4" />
		</a>

		<button
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-steam-blue text-gray-400 active:text-white"
			onclick={() => showFilters = !showFilters}
		>
			<Filter class="h-4 w-4" />
		</button>

		<button
			class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-steam-accent px-3 text-xs font-semibold text-steam-dark active:bg-steam-accent/80 disabled:opacity-50"
			onclick={syncWithSteam}
			disabled={syncing}
		>
			{#if syncing}
				<Loader2 class="h-4 w-4 animate-spin" />
			{:else}
				<RefreshCw class="h-4 w-4" />
			{/if}
			Sync
		</button>

		<button
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-steam-blue text-gray-400 active:text-white"
			onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
		>
			<ArrowUp class="h-4 w-4" />
		</button>
	</div>
</div>
