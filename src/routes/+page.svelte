<script lang="ts">
	import {
		Gamepad2, Library, Globe, RefreshCw, Plus
	} from '@lucide/svelte';
	import GameCard from '#lib/components/game_card.svelte';
	import MobileBar from '#lib/components/mobile_bar.svelte';
	import SegmentedControl from '#lib/components/segmented_control.svelte';
	import SearchField from '#lib/components/search_field.svelte';
	import StatTile from '#lib/components/stat_tile.svelte';
	import ActionButton from '#lib/components/action_button.svelte';
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

	// Games at 100% in the current scope — the "how many platinums" figure.
	let completedGames = $derived(
		scopedGames.filter((g) => g.totalAchievements > 0 && (completions[g.appId] ?? 0) >= g.totalAchievements).length
	);

	// Whether an account is connected, for the subtitle. Read through the same
	// guard as every other localStorage access — the server cannot see it.
	let steamIdHint = $state(false);
	$effect(() => {
		if (browser) steamIdHint = Boolean(localStorage.getItem('platworks:steamId'));
	});

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

			// ---------------------------------------------------------------------
			// Shared-element navigation: the card you tapped becomes the game hero.
			//
			// `view-transition-name` must be UNIQUE across rendered elements. Two elements
			// sharing one name abort the entire transition and fall back to the root
			// cross-fade — so this is deliberately NOT driven by `:hover`. If it were, every
			// card the pointer had ever crossed would keep its name and the second tap would
			// produce nothing.
			//
			// A pointer leaves a trail and a finger does not, so the two inputs set and clear
			// it differently:
			//   - `onhover` on the card's <a> names it on `mouseenter` and clears on
			//     `mouseleave` (also fires when the pointer leaves via a child)
			//   - `onfocus` names it for keyboard users, because a focused card is the one
			//     they are about to activate
			//   - `onclick` names it unconditionally and never clears, which is what covers a
			//     touch tap where there is no hover at all
			//
			// `+layout.svelte` releases the name after the swap lands.
			// ---------------------------------------------------------------------
			let navigatingAppId = $state<number | null>(null);

			function nameTransition(appId: number, on: boolean) {
				navigatingAppId = on ? appId : null;
			}

			function beginNavigation(appId: number) {
				navigatingAppId = appId;
			}
</script>

<!--
	The bottom padding clears the fixed mobile bar, and adds the safe-area inset
	because that bar grows by it (see the SAFE-AREA INSETS block in `app.css`).
	Without the `calc`, the last row of games sits under the home indicator on an
	installed iPhone. Zero in a browser tab, so the desktop layout is untouched.
-->
<div class="w-full px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
	<!-- Hero -->
	<section class="mb-6 sm:mb-8">
		<!--
			Names the library actually on screen. This was hardcoded to "Your Library"
			while the switcher below moved between two different ones, so browsing the
			catalogue still claimed to be your own library. It now mirrors the active
			tab, which is the whole point of the switcher being there.
		-->
			<h1 class="font-display text-2xl font-bold tracking-tight sm:text-3xl">{libraryName}</h1>
			<p class="mt-1 text-sm text-ink-dim">
				{totalGames} {totalGames === 1 ? 'game' : 'games'}
				{#if browser && steamIdHint}· Steam ID connected, synced 4 min ago{/if}
			</p>
	</section>

	<!--
			Four stat tiles, replacing one line of muted grey spans.

			"847/1994 · 42%" was this app's entire value proposition rendered as the
			least prominent text on the page. The tiles give the totals a hierarchy —
			overall completion leads, in the accent colour, because it is the number
			that answers "how am I doing?".

			Wrapped in a single always-present grid rather than added per-statistic, so
			no tile can appear or vanish mid-gesture and shove the grid down.
	-->
	<div class="mb-5 grid grid-cols-2 gap-2.5 sm:mb-6 sm:grid-cols-4 sm:gap-3">
			<StatTile label="Overall" value={totalPercent} suffix="%" accent roll={hydrated} />
			<StatTile label="Unlocked" value={totalCompleted} suffix={` / ${totalAchievements}`} roll={hydrated} />
			<StatTile label="Remaining" value={totalAchievements - totalCompleted} roll={hydrated} />
			<StatTile label="Completed games" value={completedGames} suffix={` / ${totalGames}`} roll={hydrated} />
	</div>

	<!--
		One toolbar, one row: scope → search → sort → sync.

		Scope is the FIRST control in the row rather than a block of its own above
		it. In a block container a `display:flex` element fills the width, so the
		switcher stretched the full page width on its own line; as a flex item it
		shrink-wraps and sits inline with the rest.

		The scope switcher always describes the totals above, which is what makes the
		headline figure mean "your games" rather than "the whole repo".

		ALWAYS rendered, including before anything has been added. It used to appear
		the moment the first game was picked, which shoved the whole grid down
		mid-gesture — the cards the user had just tapped moved out from under their
		finger. A control that exists from the first paint can only have its own
		state change, so the first add costs a "0 → 1" count and nothing moves.
	-->
	<!--
		`pw-quiet` wraps the control-dense rows and nothing else. It is a flat
				`--pw-bg` band painted by a `::before`, so the background pattern stops here
				instead of speckling behind a row of segmented controls. It masks at both
				ends, so there is no seam where it starts. See the BACKGROUND PATTERN block
				in `app.css` — and note that putting `z-index: -1` on this wrapper instead
				of its `::before` makes every control in it unclickable.

		Everything inside is unchanged: the same controls, the same order, the same
		unconditional rendering. The band is a wrapper, not a change to the toolbar.
	-->
	<div class="pw-quiet">
		<div class="mb-5 flex flex-wrap items-center gap-2 sm:gap-3">
			<SegmentedControl
				bind:value={scope}
				label="Library scope"
				options={[
					{ value: 'mine', label: 'My Library', icon: Library, count: myGames.length },
					{ value: 'all', label: 'All Games', icon: Globe, count: data.games.length }
				]}
			/>

			<!-- Hidden below `sm`: the mobile bar owns search on a phone. One search box
			     per breakpoint, never both on screen. Same rule as `game_filters.svelte`. -->
			<div class="hidden min-w-[10rem] flex-1 sm:block">
				<SearchField
					bind:query={searchQuery}
					placeholder="Search games…"
					label="Search games"
					oninput={updateSearchUrl}
				/>
			</div>

			<!-- Sort is always visible, at every breakpoint, exactly like the game page's
			     filters. It used to move into the mobile bar's panel, which made the
			     control you use to reorder the list two taps away on a phone and one away
			     on a laptop — the same task at two different costs. -->
			<SegmentedControl
				bind:value={sortBy}
				label="Sort games"
				size="sm"
				options={[
					{ value: 'name', label: 'A–Z' },
					{ value: 'completion', label: 'Completion' },
					{ value: 'recent', label: 'Recent' }
				]}
			/>

			<div class="hidden sm:block">
				<ActionButton label="Sync all" icon={RefreshCw} onclick={syncAllGames} loading={syncing} />
			</div>
		</div>

		<!--
			First-run hint, in a slot that is always exactly one line tall. It used to
			live below the grid, where nobody scrolls to see it, and it still shifted
			the page when it appeared or went away. Fixed height + placed where the
			action is means it costs nothing to show and nothing to hide.

			`aria-live` because this is the one place the page reports the selection
			changing to a screen reader after a "+" tap.
		-->
		<div class="-mt-2 mb-5 h-5" aria-live="polite">
			{#if hydrated && data.games.length > 0 && myLibrary.length === 0}
				<p class="text-xs leading-5 text-ink-faint">
					Tap the <span class="font-semibold text-steam-accent">+</span> on any game to build
					<span class="font-semibold text-ink-dim">My Library</span> — your totals follow it.
				</p>
			{/if}
		</div>
	</div>

	{#if syncStatus}
		<p class="mb-4 text-center text-xs {syncStatus.includes('failed') ? 'text-red-400' : 'text-steam-green'} sm:text-left">{syncStatus}</p>
	{/if}

	{#if data.games.length === 0}
		<div class="flex flex-col items-center gap-4 py-20 text-center">
			<Gamepad2 class="h-16 w-16 text-ink-faint" />
			<p class="font-display text-lg text-ink-dim">No games added yet</p>
			<p class="text-sm text-ink-faint">Use <code class="rounded bg-steam-blue px-2 py-0.5">/generate-game-data</code> to add a game.</p>
		</div>
	{:else if !hydrated}
			<!--
				Placeholder so the server markup and the first client render agree on layout.

				SHAPED, not a flat block. The old rows were `aspect-[16/10]` rectangles, which
				is not the card's real 16:9 artwork plus a text foot — so the grid still
				resized when the data landed. This reproduces the card's silhouette: 16:9
				artwork, a title line, a 5px bar and a caption line. Same grid, same columns,
				so nothing below the fold moves.
			-->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
				{#each Array(Math.min(scopedGames.length, 10)) as _, i (i)}
					<div class="pw-skeleton p-0">
						<div class="pw-skeleton-fill aspect-video w-full rounded-none" style="border-radius:0.75rem 0.75rem 0 0"></div>
						<div class="space-y-2 px-3 py-2.5">
							<div class="pw-skeleton-fill h-3.5 w-3/4"></div>
							<div class="pw-skeleton-fill h-1 w-full rounded-full"></div>
							<div class="pw-skeleton-fill h-2.5 w-1/3"></div>
						</div>
					</div>
				{/each}
			</div>
	{:else if scope === 'mine' && myLibrary.length === 0}
		<!--
			The player opened My Library before adding anything. A real, explainable
			state — not a dead end, and not something to silently redirect away from.
		-->
		<div class="flex flex-col items-center gap-3 py-16 text-center">
			<Library class="h-12 w-12 text-steam-accent" />
			<p class="font-display text-base font-semibold text-ink">Your library is empty</p>
			<p class="max-w-xs text-sm text-ink-dim">
				Add the games you own and every total, percentage and sync will track only those.
			</p>
			<div class="mt-1">
				<ActionButton label="Browse all games" icon={Plus} onclick={() => (scope = 'all')} />
			</div>
		</div>
	{:else if scope === 'mine' && myGames.length === 0}
		<!-- The selection still holds appIds that no longer exist in the catalogue. -->
		<div class="flex flex-col items-center gap-3 py-16 text-center">
			<Library class="h-12 w-12 text-ink-faint" />
			<p class="text-ink-dim">None of your saved games are in the catalogue any more.</p>
			<ActionButton label="Reset my library" onclick={resetLibrary} />
		</div>
	{:else if filteredAndSorted.length === 0}
		<div class="py-16 text-center">
			<p class="text-ink-dim">No games match “{searchQuery}”</p>
			<div class="mt-3 flex justify-center">
				<ActionButton
					label="Clear search"
					variant="secondary"
					onclick={() => {
						searchQuery = '';
						updateSearchUrl('');
					}}
				/>
			</div>
		</div>
	{:else}
		<!--
			Denser than the old 1→5 column grid. The card lost its 112px ring and is
			now dominated by a 16:9 image plus two short lines, so the minimum
			readable width dropped to ~170px and a laptop fits ~12 games above the
			fold instead of 6.
		-->
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
					{#each filteredAndSorted as game (game.appId)}
						<GameCard
							{game}
							completed={completions[game.appId] ?? 0}
							onToggle={toggleGame}
							transitionName={navigatingAppId === game.appId ? 'pw-game-art' : undefined}
							onnavigate={beginNavigation}
							onhover={nameTransition}
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
				type="button"
				class="h-10 rounded-lg border border-line px-4 text-sm text-ink-dim hover:bg-steam-blue hover:text-ink"
				onclick={resetLibrary}
			>
				Clear my library
			</button>
		</div>
	{/if}
</div>

<!--
	Mobile bottom bar.

	Deliberately passes NO `panel` snippet. Sort now lives in the page toolbar at
	every breakpoint, the same as the game page's filters, so the bar carries
	progress, search and sync only. The filter button hides itself when `panel`
	is absent.
-->
<MobileBar
	percent={totalPercent}
	primary="{totalCompleted}/{totalAchievements}"
	secondary={mobileCount}
	status={syncStatus}
	statusTone={syncStatus?.includes('fail') ? 'error' : 'ok'}
	syncing={syncing}
	onsync={syncAllGames}
	searchPlaceholder="Search games…"
	searchLabel="Search games"
	bind:query={searchQuery}
	onsearch={updateSearchUrl}
/>