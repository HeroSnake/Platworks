<script lang="ts">
	import {
		Trophy, Gamepad2, Search, RefreshCw, Loader2, Library, Globe, Plus
	} from '@lucide/svelte';
	import GameCard from '#lib/components/game_card.svelte';
	import MobileBar from '#lib/components/mobile_bar.svelte';
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { refreshProfile } from '#lib/client/profile';
	import { loadLibrary, addToLibrary, removeFromLibrary, clearLibrary } from '#lib/client/library';

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
	let syncing = $state(false);
	let syncStatus = $state<string | null>(null);

	// Read Steam ID from localStorage (managed by the global navbar)
	function getSteamId(): string {
		return browser ? (localStorage.getItem('platworks:steamId') ?? '') : '';
	}

	function updateSearchUrl(q: string) {
		const url = new URL(page.url.href);
		if (q.trim()) url.searchParams.set('q', q.trim());
		else url.searchParams.delete('q');
		// replaceState() rather than goto(..., { shallow: true }).
		//
		// In SvelteKit 3 the shallow goto path still calls _before_navigate(), which
		// fires onNavigate — and +layout.svelte runs a page-slide View Transition there.
		// So "shallow" still animated once per keystroke. update_state() deliberately
		// skips the navigation hooks for the legacy push/replaceState callers only, so
		// this is the one API that updates the URL without touching the page lifecycle.
		// It logs a one-time dev deprecation warning; that is the price of not animating.
		replaceState(url, page.state);
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

	// The server can't read localStorage, so it always renders A–Z. Hydrating straight
	// into a persisted sort hands Svelte a keyed each-block whose order differs from the
	// server markup: hydration claims the existing nodes positionally and never rewrites
	// attributes like <img src>, so every card ends up wearing the previous game's image.
	// The grid therefore stays off the DOM until we know we're on the client.
	let hydrated = $state(false);

	// ---- User library vs public library -------------------------------------
	// `data.games` is the public catalogue: it grows whenever a game is added to the
	// repo. The player picks their own subset, stored as appIds in localStorage, and
	// every total on this page is measured against that subset — so importing a new
	// game can never silently move someone's completion percentage.
	let myLibrary = $state<number[]>([]);
	let scope = $state<'mine' | 'all'>('all');

	// Loaded in the same effect as the hydration gate, and deliberately before it:
	// the gate exists to keep the first client render identical to the SSR markup,
	// and the grid it reveals must already know the real selection. Opening the gate
	// first would render the catalogue for a frame and then swap to the user's games.
	$effect(() => {
		const stored = loadLibrary();
		myLibrary = stored;
		// A returning player with a selection lands on their own library. An empty
		// one has nothing to show, so they get the public catalogue instead.
		if (stored.length > 0) scope = 'mine';
		hydrated = true;
	});

	let myLibrarySet = $derived(new Set(myLibrary));
	let myGames = $derived(data.games.filter((g) => myLibrarySet.has(g.appId)));

	// `scope` is authoritative. 'mine' with an empty selection is a real state with
	// its own empty view, not a dead tab: the switcher is always on screen, so
	// coercing 'mine' → 'all' whenever the library is empty would have made
	// "My Library (0)" do nothing at all when clicked.
	let scopedGames = $derived(scope === 'mine' ? myGames : data.games);

	// Must match the switcher's own labels exactly. The heading and the active tab
	// describing different libraries is the same class of bug as the switcher
	// appearing late: the page tells you two things at once.
	let libraryName = $derived(scope === 'mine' ? 'My Library' : 'All Games');

	function toggleGame(appId: number) {
		if (myLibrarySet.has(appId)) {
			myLibrary = removeFromLibrary(appId);
		} else {
			myLibrary = addToLibrary(appId);
		}
	}

	function resetLibrary() {
		myLibrary = clearLibrary();
		scope = 'all';
	}

	let totalGames = $derived(scopedGames.length);
	let totalAchievements = $derived(scopedGames.reduce((s, g) => s + g.totalAchievements, 0));
	let totalCompleted = $derived(scopedGames.reduce((s, g) => s + (completions[g.appId] ?? 0), 0));
	let totalPercent = $derived(totalAchievements > 0 ? Math.round((totalCompleted / totalAchievements) * 100) : 0);

	let filteredAndSorted = $derived.by(() => {
		let list = scopedGames;
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

	// The bar's subtitle drops to "N of M" only while a search is actually narrowing
	// the list, so it never shows a redundant "12 of 12".
	let mobileCount = $derived.by(() => {
		const shown = filteredAndSorted.length;
		const total = scopedGames.length;
		return shown === total ? `${total} ${total === 1 ? 'game' : 'games'}` : `${shown} of ${total}`;
	});

	async function syncAllGames() {
		const sid = getSteamId();
		if (!sid) {
			syncStatus = 'Set your Steam ID in the account menu (top right)';
			return;
		}
		syncing = true;
		syncStatus = null;

		const incomplete = scopedGames.filter((g) => (completions[g.appId] ?? 0) < g.totalAchievements);
		let totalSynced = 0;
		let errors = 0;
		let anyConnected = false;

		for (const game of incomplete) {
			try {
				const res = await fetch(`/api/steam/sync/${game.appId}?steamId=${encodeURIComponent(sid)}`);
				const json = await res.json();
				if (!json.connected) { errors++; continue; }
				anyConnected = true;

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

		// Once per sync run (not once per game) — refresh the cached profile card.
		if (anyConnected) refreshProfile(sid);

		refreshCompletions();
		syncing = false;
		syncStatus = totalSynced > 0
			? `Synced ${totalSynced} game${totalSynced > 1 ? 's' : ''}${errors > 0 ? `, ${errors} failed` : ''}`
			: errors > 0 ? `${errors} game${errors > 1 ? 's' : ''} failed to sync` : 'All games up to date';
		setTimeout(() => syncStatus = null, 4000);
	}
</script>

<div class="w-full px-4 pb-20 pt-6 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
	<!-- Hero -->
	<section class="mb-6 sm:mb-8">
		<!--
			Names the library actually on screen. This was hardcoded to "Your Library"
			while the switcher below moved between two different ones, so browsing the
			catalogue still claimed to be your own library. It now mirrors the active
			tab, which is the whole point of the switcher being there.
		-->
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{libraryName}</h1>
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

	<!--
		Scope switcher. The totals above always describe whatever this selects, which is
		what makes the headline figure mean "your games" rather than "the whole repo".

		ALWAYS rendered, including before anything has been added. It used to appear the
		moment the first game was picked, which shoved the whole grid down mid-gesture —
		the cards the user had just tapped moved out from under their finger. A control
		that exists from the first paint can only have its own state change, so the
		first add costs a "0 → 1" count and nothing moves.
	-->
	<div class="mb-4 sm:mb-5">
		<div class="flex h-10 gap-1 rounded-lg bg-steam-blue p-1 sm:w-fit" role="group" aria-label="Library scope">
			<button
				class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none {scope === 'mine'
					? 'bg-steam-accent text-steam-dark'
					: 'text-gray-400'}"
				onclick={() => (scope = 'mine')}
				aria-pressed={scope === 'mine'}
			>
				<Library class="h-4 w-4" />
				My Library
				<span class="tabular-nums opacity-70">{myGames.length}</span>
			</button>
			<button
				class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none {scope === 'all'
					? 'bg-steam-accent text-steam-dark'
					: 'text-gray-400'}"
				onclick={() => (scope = 'all')}
				aria-pressed={scope === 'all'}
			>
				<Globe class="h-4 w-4" />
				All Games
				<span class="tabular-nums opacity-70">{data.games.length}</span>
			</button>
		</div>

		<!--
			First-run hint, in a slot that is always exactly one line tall. It used to
			live below the grid, where nobody scrolls to see it, and it still shifted
			the page when it appeared or went away. Fixed height + placed where the
			action is means it costs nothing to show and nothing to hide.

			`aria-live` because this is the one place the page reports the selection
			changing to a screen reader after a "+" tap.
		-->
		<div class="mt-2 h-5" aria-live="polite">
			{#if hydrated && data.games.length > 0 && myLibrary.length === 0}
				<p class="text-xs leading-5 text-gray-500">
					Tap the <span class="font-semibold text-steam-accent">+</span> on any game to build
					<span class="font-semibold text-gray-400">My Library</span> — your totals follow it.
				</p>
			{/if}
		</div>
	</div>

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
	{:else if !hydrated}
		<!-- Placeholder so the server markup and the first client render agree on layout. -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
			{#each Array(Math.min(scopedGames.length, 10)) as _, i (i)}
				<div class="min-h-40 animate-pulse rounded-lg bg-steam-blue sm:min-h-48"></div>
			{/each}
		</div>
	{:else if scope === 'mine' && myLibrary.length === 0}
		<!--
			The player opened My Library before adding anything. A real, explainable
			state — not a dead end, and not something to silently redirect away from.
		-->
		<div class="flex flex-col items-center gap-3 py-16 text-center">
			<Library class="h-12 w-12 text-steam-accent" />
			<p class="text-base font-semibold text-gray-200">Your library is empty</p>
			<p class="max-w-xs text-sm text-gray-500">
				Add the games you own and every total, percentage and sync will track only those.
			</p>
			<button
				class="mt-1 inline-flex h-10 items-center gap-2 rounded-lg bg-steam-accent px-4 text-sm font-semibold text-steam-dark"
				onclick={() => (scope = 'all')}
			>
				<Plus class="h-4 w-4" />
				Browse all games
			</button>
		</div>
	{:else if scope === 'mine' && myGames.length === 0}
		<!-- The selection still holds appIds that no longer exist in the catalogue. -->
		<div class="flex flex-col items-center gap-3 py-16 text-center">
			<Library class="h-12 w-12 text-gray-600" />
			<p class="text-gray-500">None of your saved games are in the catalogue any more.</p>
			<button class="h-10 rounded-lg bg-steam-accent px-4 text-sm font-semibold text-steam-dark" onclick={resetLibrary}>
				Reset my library
			</button>
		</div>
	{:else if filteredAndSorted.length === 0}
		<p class="py-12 text-center text-gray-500">No games match "{searchQuery}"</p>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
			{#each filteredAndSorted as game (game.appId)}
				<GameCard
					{game}
					completed={completions[game.appId] ?? 0}
					onToggle={toggleGame}
					toggleMode={scope === 'mine'
						? 'remove'
						: myLibrarySet.has(game.appId)
							? 'added'
							: 'add'}
				/>
			{/each}
		</div>
	{/if}

	{#if hydrated && myLibrary.length > 0 && scope === 'mine'}
		<div class="mt-8 flex justify-center sm:mt-10">
			<button
				class="h-10 rounded-lg border border-white/10 px-4 text-sm text-gray-400 hover:bg-steam-blue hover:text-gray-200"
				onclick={resetLibrary}
			>
				Clear my library
			</button>
		</div>
	{/if}
</div>

<!-- Mobile bottom bar -->
<MobileBar
	percent={totalPercent}
	primary="{totalCompleted}/{totalAchievements}"
	secondary={mobileCount}
	status={syncStatus}
	statusTone={syncStatus?.includes('failed') || syncStatus?.includes('fail') ? 'error' : 'ok'}
	syncing={syncing}
	onsync={syncAllGames}
	searchPlaceholder="Search games..."
	bind:query={searchQuery}
	onsearch={updateSearchUrl}
>
	{#snippet panel()}
		<select class="w-full rounded-lg border-none bg-steam-blue px-3 py-2 text-sm text-gray-300 outline-none" bind:value={sortBy}>
			<option value="name">A–Z</option>
			<option value="completion">Completion</option>
			<option value="recent">Recent</option>
		</select>
	{/snippet}
</MobileBar>