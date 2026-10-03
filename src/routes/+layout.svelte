<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { Trophy, ArrowLeft, User, RefreshCw, Loader2, ExternalLink } from '@lucide/svelte';
	import GithubIcon from '#lib/components/github_icon.svelte';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { browser } from '$app/env';
	import { loadProfile, refreshProfile, clearProfile, type StoredProfile } from '#lib/client/profile';

	/** Keep in step with the `origin` remote — change this and the README link together. */
	const REPO_URL = 'https://github.com/HeroSnake/Platworks';

	let { children } = $props();

	let isHome = $derived(page.url.pathname === '/');
	let isGamePage = $derived(page.url.pathname.startsWith('/game/'));
	let gameName = $derived(
		// `||` — CDN fallback leaves steam.name as '' when appdetails is blocked.
		isGamePage ? ((page.data as any)?.steam?.name || (page.data as any)?.game?.name || '') : ''
	);
	let showSteamId = $state(false);
	let steamId = $state(browser ? (localStorage.getItem('platworks:steamId') ?? '') : '');

	// Served straight from localStorage — we never hit Steam just to render a page.
	let profile = $state<StoredProfile | null>(loadProfile());
	let refreshingProfile = $state(false);
	let profileError = $state<string | null>(null);

	// The account menu floats above the page rather than expanding the nav, so opening
	// or closing it never reflows the content underneath.
	let menuWrap: HTMLElement | null = $state(null);

	function saveSteamId() {
		if (!browser) return;
		localStorage.setItem('platworks:steamId', steamId);
		// The cached avatar/name belongs to the previous ID, so drop it immediately
		// rather than showing one account's face next to another account's ID.
		clearProfile();
		profile = null;
		profileError = null;
	}

	/** Pulls the Steam profile once and caches it. Called after syncs and on demand. */
	async function refreshSteamProfile() {
		const sid = steamId.trim();
		if (!sid) return null;
		refreshingProfile = true;
		profileError = null;
		const stored = await refreshProfile(sid);
		profile = stored;
		if (!stored) profileError = 'Could not read the Steam profile. It may be private.';
		// refreshProfile() may have persisted the resolved Steam64 ID — adopt it so the
		// input shows the canonical ID and future syncs skip vanity resolution.
		if (stored && browser) steamId = localStorage.getItem('platworks:steamId') ?? stored.steamId;
		refreshingProfile = false;
		return stored;
	}

	function toggleSteamPanel() {
		showSteamId = !showSteamId;
		// Fetch only when there is no cache to show, so opening the panel stays instant.
		if (showSteamId && !profile && steamId.trim() && !refreshingProfile) {
			refreshSteamProfile();
		}
	}

	function commitSteamId() {
		if (!steamId.trim()) return;
		refreshSteamProfile();
	}

	// Dismiss on outside click or Escape. The listeners only exist while the menu is
	// open, so an idle page pays nothing for them.
	$effect(() => {
		if (!showSteamId) return;
		const onPointerDown = (e: PointerEvent) => {
			if (menuWrap && !menuWrap.contains(e.target as Node)) showSteamId = false;
		};
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') showSteamId = false;
		};
		window.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('keydown', onKeydown);
		return () => {
			window.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('keydown', onKeydown);
		};
	});

	onNavigate((navigation) => {
		showSteamId = false;
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<title>PlatWorks — Steam Achievement Companion</title>
	<meta name="description" content="Your completionist companion for Steam achievements. Step-by-step guides, missable alerts, progress tracking, and Steam sync." />
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#171a21" />
	<meta property="og:title" content="PlatWorks" />
	<meta property="og:description" content="Break down Steam achievements into step-by-step guides, missable alerts, and progress tracking." />
	<meta property="og:type" content="website" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="PlatWorks" />
	<link rel="apple-touch-icon" href="/icon.svg" />
</svelte:head>

<div class="min-h-screen bg-steam-dark text-gray-100">
	<nav class="sticky-nav sticky top-0 z-50 border-b border-white/5 bg-steam-dark/80 backdrop-blur-md">
		<!-- Taller on mobile (64px vs 56px) so the controls get real thumb-sized hit
		     areas; every interactive element in here is 44px wide below `sm`. -->
		<div class="flex h-16 w-full items-center gap-2 px-3 sm:h-14 sm:gap-2.5 sm:px-6 lg:px-8">
			{#if !isHome}
				<a
					href="/"
					class="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 active:bg-steam-blue sm:-ml-1 sm:h-9 sm:w-9"
					aria-label="Back to games"
				>
					<ArrowLeft class="h-6 w-6 sm:h-5 sm:w-5" />
				</a>
			{/if}

			<a href="/" class="flex min-w-0 items-center gap-2 rounded-lg px-1 py-2 font-semibold tracking-tight">
				<Trophy class="h-6 w-6 shrink-0 text-steam-accent sm:h-5 sm:w-5" />
				<span class="truncate text-lg sm:text-base {isGamePage ? 'hidden sm:inline' : ''}">PlatWorks</span>
			</a>

			{#if isGamePage && gameName}
				<span class="min-w-0 truncate text-base text-gray-300 sm:hidden">{gameName}</span>
			{/if}

			<!-- Right-hand controls share one flex row so the account popover can stay
			     absolutely positioned relative to its own button. -->
			<div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
				<a
					href={REPO_URL}
					target="_blank"
					rel="noreferrer noopener"
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 active:bg-steam-blue sm:h-9 sm:w-9"
					aria-label="PlatWorks on GitHub"
					title="PlatWorks on GitHub"
				>
					<GithubIcon class="h-6 w-6 sm:h-5 sm:w-5" />
				</a>

				<div class="relative shrink-0" bind:this={menuWrap}>
					<button
						class="flex items-center gap-2 rounded-full pl-1 pr-1 sm:py-1 sm:pr-3 {showSteamId ? 'bg-steam-blue' : 'active:bg-steam-blue'} {steamId && !profile ? 'text-steam-accent' : ''}"
						onclick={toggleSteamPanel}
						aria-label="Steam account"
						aria-expanded={showSteamId}
						aria-haspopup="true"
					>
						{#if profile?.avatar}
							<img
								src={profile.avatar}
								alt={profile.name}
								class="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/10 sm:h-7 sm:w-7"
							/>
						{:else}
							<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-steam-blue sm:h-7 sm:w-7">
								<User class="h-6 w-6 text-gray-400 sm:h-5 sm:w-5" />
							</span>
						{/if}
						{#if profile?.name}
							<span class="hidden max-w-[9rem] truncate text-sm text-gray-200 md:block">{profile.name}</span>
						{/if}
					</button>

				{#if showSteamId}
					<!-- Floats over the page instead of expanding the nav, so nothing below
					     shifts when it opens. Width is capped to the viewport so it stays
					     fully on-screen down to ~320px wide. -->
					<div class="pop-in absolute right-0 top-[calc(100%+0.5rem)] w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-white/10 bg-steam-dark/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
						{#if profile}
							<div class="flex items-center gap-3 border-b border-white/5 p-3">
								{#if profile.avatar}
									<img
										src={profile.avatar}
										alt={profile.name}
										class="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/10"
									/>
								{:else}
									<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-steam-blue">
										<User class="h-5 w-5 text-gray-400" />
									</span>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-semibold text-gray-100">{profile.name}</p>
									<p class="truncate text-xs text-gray-500">{profile.steamId}</p>
								</div>
								{#if profile.visibility && profile.visibility !== '3'}
									<span class="shrink-0 rounded bg-yellow-900/50 px-2 py-1 text-[10px] text-yellow-300">Private</span>
								{/if}
							</div>
						{/if}

						<div class="p-3">
							<label for="steam-id" class="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
								Steam ID or vanity name
							</label>
							<div class="flex items-center gap-2 rounded-lg bg-steam-blue px-3 py-2 focus-within:ring-1 focus-within:ring-steam-accent/60">
								<User class="h-4 w-4 shrink-0 text-gray-500" />
								<input
									id="steam-id"
									type="text"
									inputmode="numeric"
									autocomplete="off"
									spellcheck="false"
									placeholder="76561198… or profile URL"
									class="min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
									bind:value={steamId}
									oninput={saveSteamId}
									onkeydown={(e) => { if (e.key === 'Enter') commitSteamId(); }}
								/>
							</div>

							{#if profileError}
								<p class="mt-2 text-xs text-red-400">{profileError}</p>
							{:else if steamId.trim() && !profile && !refreshingProfile}
								<p class="mt-2 truncate text-xs text-gray-500">Connected: {steamId}</p>
							{/if}

							<div class="mt-3 flex items-center gap-2">
								<button
									class="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-steam-accent px-3 text-sm font-semibold text-steam-dark active:bg-steam-accent/80 disabled:opacity-50"
									onclick={commitSteamId}
									disabled={!steamId.trim() || refreshingProfile}
								>
									{#if refreshingProfile}
										<Loader2 class="h-4 w-4 animate-spin" />
									{:else if profile}
										<RefreshCw class="h-4 w-4" />
									{/if}
									{profile ? 'Refresh' : 'Connect'}
								</button>
								{#if profile}
									<a
										href={profile.profileUrl}
										target="_blank"
										rel="noreferrer noopener"
										class="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-steam-blue px-3 text-sm text-gray-300 active:bg-steam-light"
									>
										<ExternalLink class="h-4 w-4" />
										Profile
									</a>
								{/if}
							</div>
						</div>
					</div>
				{/if}
				</div>
			</div>
		</div>
	</nav>

	<main>
		{@render children()}
	</main>
</div>
