<script lang="ts">
	import {
		Trophy, Gamepad2, CheckCircle, Search, RefreshCw, Loader2, ArrowUp, Filter
	} from '@lucide/svelte';
	import GameCard from '$lib/components/game_card.svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let { data } = $props();

	function getCheckedCount(appId: number, ids: string[]): number {
		if (!browser) return 0;
		try {
			const stored: Record<string, boolean> = JSON.parse(localStorage.getItem(`platworks:checked:${appId}`) ?? '{}');
			return ids.filter((id) => stored[id]).length;
		} catch {
			return 0;
		}
	}

	function getLastCheckedTime(appId: number): number {
		if (!browser) return 0;
		return Number(localStorage.getItem(`platworks:lastChecked:${appId}`) ?? '0');
	}

	let completions = $state<Record<number, number>>({});
	let lastChecked = $state<Record<number, number>>({});

	function refreshCompletions() {
		if (!browser) return;
		const cMap: Record<number, number> = {};
		const tMap: Record<number, number> = {};
		for (const g of data.games) {
			cMap[g.appId] = getCheckedCount(g.appId, g.achievementIds);
			tMap[g.appId] = getLastCheckedTime(g.appId);
		}
		completions = cMap;
		lastChecked = tMap;
	}

	$effect(() => { refreshCompletions(); });

	let searchQuery = $state(page.url.searchParams.get('q') ?? '');
	let showSearch = $state(false);
	let showFilters = $state(false);
	let syncing = $state(false);
	let syncStatus = $state<string | null>(null);

	// Read Steam ID from localStorage (managed by the global navbar)
	function getSteamId(): string {
		return browser ? (localStorage.getItem('platworks:steamId') ?? '') : '';
	}

	function updateSearchUrl(q: string) {
		const url = new URL(page.url);
		if (q.trim()) url.searchParams.set('q', q.trim());
		else url.searchParams.delete('q');
		goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
	}

	let sortBy = $state<'name' | 'completion' | 'recent'>(loadSort());

	function loadSort(): 'name' | 'completion' | 'recent' {
		if (!browser) return 'name';
		const v = localStorage.getItem('platworks:sort');
		if (v === 'completion' || v === 'recent') return v;
		return 'name';
	}

	$effect(() => {
		if (browser) localStorage.setItem('platworks:sort', sortBy);
	});

	let totalGames = $derived(data.games.length);
	let totalAchievements = $derived(data.games.reduce((s, g) => s + g.totalAchievements, 0));
	let totalCompleted = $derived(Object.values(completions).reduce((s, c) => s + c, 0));
	let totalPercent = $derived(totalAchievements > 0 ? Math.round((totalCompleted / totalAchievements) * 100) : 0);

	let filteredAndSorted = $derived.by(() => {
		let list = data.games;
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			list = list.filter((g) => g.name.toLowerCase().includes(q));
		}
		return [...list].sort((a, b) => {
			if (sortBy === 'completion') {
				const pA = a.totalAchievements > 0 ? (completions[a.appId] ?? 0) / a.totalAchievements : 0;
				const pB = b.totalAchievements > 0 ? (completions[b.appId] ?? 0) / b.totalAchievements : 0;
				return pB - pA;
			}
			if (sortBy === 'recent') {
				return (lastChecked[b.appId] ?? 0) - (lastChecked[a.appId] ?? 0);
			}
			return a.name.localeCompare(b.name);
		});
	});

	async function syncAllGames() {
		const sid = getSteamId();
		if (!sid) {
			syncStatus = 'Set your Steam ID in the account menu (top right)';
			return;
		}
		syncing = true;
		syncStatus = null;

		const incomplete = data.games.filter((g) => (completions[g.appId] ?? 0) < g.totalAchievements);
		let totalSynced = 0;
		let errors = 0;

		for (const game of incomplete) {
			try {
				const res = await fetch(`/api/steam/sync/${game.appId}?steamId=${encodeURIComponent(sid)}`);
				const json = await res.json();
				if (!json.connected) { errors++; continue; }

				const stored: Record<string, boolean> = JSON.parse(localStorage.getItem(`platworks:checked:${game.appId}`) ?? '{}');
				const steamMap = json.achievements as Record<string, { achieved: boolean }>;
				let changed = false;
				for (const [steamName, status] of Object.entries(steamMap)) {
					if (!status.achieved) continue;
					const achId = game.achievementNames[steamName];
					if (achId && !stored[achId]) {
						stored[achId] = true;
						changed = true;
					}
				}
				if (changed) {
					localStorage.setItem(`platworks:checked:${game.appId}`, JSON.stringify(stored));
					localStorage.setItem(`platworks:lastChecked:${game.appId}`, String(Date.now()));
				}
				totalSynced++;
			} catch { errors++; }
		}

		refreshCompletions();
		syncing = false;
		syncStatus = totalSynced > 0
			? `Synced ${totalSynced} game${totalSynced > 1 ? 's' : ''}${errors > 0 ? `, ${errors} failed` : ''}`
			: errors > 0 ? `${errors} game${errors > 1 ? 's' : ''} failed to sync` : 'All games up to date';
		setTimeout(() => syncStatus = null, 4000);
	}
</script>

<div class="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:pb-16 sm:pt-10">
	<!-- Hero -->
	<section class="mb-8 sm:mb-12">
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Your Library</h1>
		<div class="mt-3 flex flex-wrap gap-4 text-sm text-gray-400">
			<span class="flex items-center gap-1.5">
				<Gamepad2 class="h-4 w-4" />
				{totalGames} {totalGames === 1 ? 'game' : 'games'}
			</span>
			<span class="flex items-center gap-1.5">
				<Trophy class="h-4 w-4" />
				{totalCompleted}/{totalAchievements}
			</span>
			{#if totalCompleted > 0}
				<span class="text-green-400">{totalPercent}%</span>
			{/if}
		</div>
	</section>

	<!-- Desktop search + sort -->
	<div class="mb-5 hidden items-center gap-3 sm:flex">
		<div class="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-steam-blue px-3 py-2">
			<Search class="h-4 w-4 shrink-0 text-gray-500" />
			<input
				type="text"
				placeholder="Search games..."
				class="min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
				bind:value={searchQuery}
				oninput={() => updateSearchUrl(searchQuery)}
			/>
		</div>
		<select class="shrink-0 rounded-lg border-none bg-steam-blue px-3 py-2 text-sm text-gray-300 outline-none" bind:value={sortBy}>
			<option value="name">A–Z</option>
			<option value="completion">Completion</option>
			<option value="recent">Recent</option>
		</select>
		<button
			class="inline-flex items-center gap-2 rounded-lg bg-steam-accent px-4 py-2 text-sm font-semibold text-steam-dark hover:bg-steam-accent/90 disabled:opacity-50"
			onclick={syncAllGames}
			disabled={syncing}
		>
			{#if syncing}<Loader2 class="h-4 w-4 animate-spin" />{:else}<RefreshCw class="h-4 w-4" />{/if}
			Sync All
		</button>
	</div>
	{#if syncStatus}
		<p class="mb-4 text-center text-xs {syncStatus.includes('failed') ? 'text-red-400' : 'text-green-400'} sm:text-left">{syncStatus}</p>
	{/if}

	{#if data.games.length === 0}
		<div class="flex flex-col items-center gap-4 py-20 text-center">
			<Gamepad2 class="h-16 w-16 text-gray-600" />
			<p class="text-lg text-gray-500">No games added yet</p>
			<p class="text-sm text-gray-600">Use <code class="rounded bg-steam-blue px-2 py-0.5">/generate-game-data</code> to add a game.</p>
		</div>
	{:else if filteredAndSorted.length === 0}
		<p class="py-12 text-center text-gray-500">No games match "{searchQuery}"</p>
	{:else}
		<div class="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredAndSorted as game (game.appId)}
				<GameCard {game} completed={completions[game.appId] ?? 0} />
			{/each}
		</div>
	{/if}
</div>

<!-- Mobile bottom bar -->
<div class="fixed-bottom-bar fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-steam-dark/95 backdrop-blur-md sm:hidden">
	{#if showSearch}
		<div class="border-b border-white/5 px-4 py-2.5">
			<div class="flex items-center gap-2 rounded-lg bg-steam-blue px-3 py-2">
				<Search class="h-4 w-4 shrink-0 text-gray-500" />
				<input
					type="text"
					placeholder="Search games..."
					class="min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
					bind:value={searchQuery}
					oninput={() => updateSearchUrl(searchQuery)}
				/>
			</div>
		</div>
	{/if}

	{#if showFilters}
		<div class="border-b border-white/5 px-4 py-2.5">
			<select class="w-full rounded-lg border-none bg-steam-blue px-3 py-2 text-sm text-gray-300 outline-none" bind:value={sortBy}>
				<option value="name">A–Z</option>
				<option value="completion">Completion</option>
				<option value="recent">Recent</option>
			</select>
		</div>
	{/if}

	{#if syncStatus}
		<div class="border-b border-white/5 px-4 py-1.5 text-center text-xs {syncStatus.includes('failed') ? 'text-red-400' : 'text-green-400'}">
			{syncStatus}
		</div>
	{/if}

	<div class="flex items-center gap-2 px-4 py-2.5">
		<div class="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
			<div class="relative h-9 w-9 shrink-0">
				<svg class="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
					<circle cx="18" cy="18" r="15.5" fill="none" stroke-width="3" class="stroke-steam-light" />
					<circle cx="18" cy="18" r="15.5" fill="none" stroke-width="3"
						stroke-dasharray={`${totalPercent * 0.974} 100`}
						stroke-linecap="round" class="stroke-steam-accent transition-all duration-500" />
				</svg>
				<span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">{totalPercent}%</span>
			</div>
			<div class="min-w-0 overflow-hidden text-xs leading-tight">
				<span class="font-semibold text-gray-200">{totalCompleted}/{totalAchievements}</span>
				<span class="block truncate text-gray-500">{filteredAndSorted.length} games</span>
			</div>
		</div>

		<button
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-steam-blue text-gray-400 active:text-white"
			onclick={() => { showSearch = !showSearch; showFilters = false; }}
		>
			<Search class="h-4 w-4" />
		</button>

		<button
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-steam-blue text-gray-400 active:text-white"
			onclick={() => { showFilters = !showFilters; showSearch = false; }}
		>
			<Filter class="h-4 w-4" />
		</button>

		<button
			class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-steam-accent px-3 text-xs font-semibold text-steam-dark active:bg-steam-accent/80 disabled:opacity-50"
			onclick={syncAllGames}
			disabled={syncing}
		>
			{#if syncing}<Loader2 class="h-4 w-4 animate-spin" />{:else}<RefreshCw class="h-4 w-4" />{/if}
			Sync
		</button>

		<button
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-steam-blue text-gray-400 active:text-white"
			onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
		>
			<ArrowUp class="h-4 w-4" />
		</button>
	</div></div>