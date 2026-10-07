<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { Trophy, ArrowLeft, User, RefreshCw, Loader2, ExternalLink } from '@lucide/svelte';
	import GithubIcon from '#lib/components/github_icon.svelte';
	import ThemePicker from '#lib/components/theme_picker.svelte';
	import { saveTheme, THEMES, type ThemeId } from '#lib/client/theme';
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

	// The palette is read back from the DOM rather than localStorage: `app.html`
	// has already applied it before first paint, so the SSR markup and the first
	// client render agree on it. Reading storage again here would be a second
	// source of truth that could disagree with what is actually on screen.
	let theme = $state<ThemeId>(browser
		? ((document.documentElement.getAttribute('data-theme') as ThemeId | null) ?? 'ember')
		: 'ember');

	/**
		 * Keeps the mobile browser chrome in step with the palette. The tag is a static
		 * default in the markup — it cannot be a binding, because the server does not
		 * know the theme. A hex cannot be derived from a CSS variable in `content`, so
		 * the live value is read back off the document once the attribute is applied.
		 */
		function setTheme(id: ThemeId) {
			theme = saveTheme(id);
			const meta = document.querySelector('meta[name="theme-color"]');
			const bg = getComputedStyle(document.documentElement).getPropertyValue('--pw-bg').trim();
			if (meta && bg) meta.setAttribute('content', bg);
		}

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
				// The shared element's SOURCE name has to be released once the swap lands.
				// It is set on the library card that was activated, and it is not Svelte
				// state there — it is a DOM write the page made on click — so nothing would
				// ever clear it. Left in place, navigating a second time finds an element
				// already carrying the name and the browser aborts the transition back to
				// a plain cross-fade.
				//
				// Both callbacks release it, and the reject path matters most: `finished`
				// REJECTS when a transition is skipped, which is exactly what a duplicate
				// name does. Without this, one collision kills every navigation after it
				// until a reload.
				const releaseArtName = () => {
					for (const el of document.querySelectorAll<HTMLElement>('[style*="pw-game-art"]')) {
						el.style.removeProperty('view-transition-name');
					}
				};

				document
					.startViewTransition(async () => {
						resolve();
						await navigation.complete;
					})
					.finished.then(releaseArtName, releaseArtName);
			});
		});
</script>

<svelte:head>
	<title>PlatWorks — Steam Achievement Companion</title>
	<meta name="description" content="Your completionist companion for Steam achievements. Step-by-step guides, missable alerts, progress tracking, and Steam sync." />
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#0c0a09" />
	<meta property="og:title" content="PlatWorks" />
	<meta property="og:description" content="Break down Steam achievements into step-by-step guides, missable alerts, and progress tracking." />
	<meta property="og:type" content="website" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="PlatWorks" />
	<link rel="apple-touch-icon" href="/icon.svg" />
</svelte:head>

<!--
	Background pattern — one fixed tile behind the whole app.

	Why an inline SVG <pattern> and not a `background-image` data URI: the tile's
	colours are CSS variables (`--pw-pattern-dash`, `--pw-pattern-trophy`), so all
	six palettes follow `data-theme` with nothing to regenerate, and a paint server
	called from SVG markup resolves everywhere. Safari will not reliably resolve
	`background-image: url(#id)` pointing at one, which is what forces the data-URI
	approach and six duplicated files. See the BACKGROUND PATTERN block in `app.css`.

	Geometry: a 135px lattice. Trophies sit on it (centre + four corners, so it
	tiles seamlessly); the 45° dash rows run on the lattice's mid-diagonals, so a
	row passes BETWEEN two trophies rather than through one. Four marks a quarter
	of a row apart, so a row divides its own segment and still tiles. Every motif
	shares the same 45° tilt — that is what makes it read as fabric.
-->
<div class="pw-pattern" aria-hidden="true">
	<svg xmlns="http://www.w3.org/2000/svg" focusable="false">
		<defs>
			<path id="pw-mark" d="M-6 -6 6 6" />
			<g id="pw-trophy" transform="translate(-1.24 12) scale(0.78) rotate(-45)" fill="none" stroke-linecap="round" stroke-linejoin="round">
				<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
				<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
				<path d="M4 22h16" />
				<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
				<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
				<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
			</g>
			<g id="pw-chains" fill="none" stroke="var(--pw-pattern-dash)" stroke-width="3.4" stroke-linecap="round">
				<use href="#pw-mark" transform="translate(0 67.5)" />
				<use href="#pw-mark" transform="translate(16.87 84.37)" />
				<use href="#pw-mark" transform="translate(33.75 101.25)" />
				<use href="#pw-mark" transform="translate(50.62 118.12)" />
				<use href="#pw-mark" transform="translate(67.5 0)" />
				<use href="#pw-mark" transform="translate(84.37 16.87)" />
				<use href="#pw-mark" transform="translate(101.25 33.75)" />
				<use href="#pw-mark" transform="translate(118.12 50.62)" />
			</g>
			<g id="pw-trophies" stroke="var(--pw-pattern-trophy)" stroke-width="1.9">
				<use href="#pw-trophy" transform="translate(67.5 67.5)" />
				<use href="#pw-trophy" transform="translate(0 0)" />
				<use href="#pw-trophy" transform="translate(135 0)" />
				<use href="#pw-trophy" transform="translate(0 135)" />
				<use href="#pw-trophy" transform="translate(135 135)" />
			</g>
			<pattern id="pw-tile" width="135" height="135" patternUnits="userSpaceOnUse">
				<use href="#pw-chains" />
				<use href="#pw-trophies" />
			</pattern>
			<!-- Same geometry at 96px. `patternTransform` scales the tile content,
			     so the stroke widths shrink with it and stay proportional. -->
			<pattern id="pw-tile-sm" width="135" height="135" patternUnits="userSpaceOnUse" patternTransform="scale(0.7111)">
				<use href="#pw-chains" />
				<use href="#pw-trophies" />
			</pattern>
		</defs>
		<rect width="100%" height="100%" />
	</svg>
</div>

<!--
	`relative z-10` is load-bearing, not decoration. The background pattern's
	`::before` band sits at `z-index: -1` and has to land above the fixed pattern
	layer, which requires this element to be a stacking context.
	`bg-steam-dark` moved to `body` in `app.css` — keeping it here would paint
	over the fixed pattern layer and hide the pattern entirely.
-->
<div class="relative z-10 min-h-screen text-ink">
	<!--
		No `backdrop-filter`. The nav was `bg-steam-dark/80 backdrop-blur-md`, which
		resampled a flat page colour for a frosted look. With the pattern behind it
		that blur smeared the tile into a soft band under the nav, so it is opaque
		now. Same for the popover and the mobile bar.
	-->
	<nav class="sticky-nav sticky top-0 z-50 border-b border-white/5 bg-steam-dark">
		<!-- Taller on mobile (64px vs 56px) so the controls get real thumb-sized hit
		     areas; every interactive element in here is 44px wide below `sm`. -->
		<div class="flex h-16 w-full items-center gap-2 px-3 sm:h-16 sm:gap-2.5 sm:px-6 lg:px-8">
			{#if !isHome}
				<a
					href="/"
					class="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-dim active:bg-steam-blue sm:-ml-1 sm:h-10 sm:w-10"
					aria-label="Back to games"
				>
					<ArrowLeft class="h-6 w-6 sm:h-5 sm:w-5" />
				</a>
			{/if}

			<a href="/" class="flex min-w-0 items-center gap-2 rounded-lg px-1 py-2 font-semibold tracking-tight">
				<Trophy class="h-6 w-6 shrink-0 text-steam-accent sm:h-5 sm:w-5" />
				<span class="truncate font-display text-lg sm:text-base {isGamePage ? 'hidden sm:inline' : ''}">PlatWorks</span>
			</a>

			{#if isGamePage && gameName}
				<span class="min-w-0 truncate text-sm font-medium text-ink-dim sm:text-base sm:hidden">{gameName}</span>
			{/if}

			<!-- Right-hand controls share one flex row so the account popover can stay
			     absolutely positioned relative to its own button. -->
			<div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
				<a
					href={REPO_URL}
					target="_blank"
					rel="noreferrer noopener"
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-dim active:bg-steam-blue sm:h-10 sm:w-10"
					aria-label="PlatWorks on GitHub"
					title="PlatWorks on GitHub"
				>
					<GithubIcon class="h-6 w-6 sm:h-5 sm:w-5" />
				</a>

				<div class="relative shrink-0" bind:this={menuWrap}>
					<!--
						`h-11` (44px) at every breakpoint. It used to shrink to 36px on desktop
						via the avatar's own `sm:h-7`, which failed the 40px tap-target floor
						measured in the layout audit. The avatar inside stays 28px; the button
						around it carries the target.
					-->
					<button
						class="flex h-11 items-center gap-2 rounded-full pl-1 pr-1 sm:pr-3 {showSteamId ? 'bg-steam-blue' : 'active:bg-steam-blue'} {steamId && !profile ? 'text-steam-accent' : ''}"
						onclick={toggleSteamPanel}
						aria-label="Steam account"
						aria-expanded={showSteamId}
						aria-haspopup="true"
					>
						{#if profile?.avatar}
							<img
								src={profile.avatar}
								alt={profile.name}
								class="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10"
							/>
						{:else}
							<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-steam-blue">
								<User class="h-5 w-5 text-ink-dim" />
							</span>
						{/if}
						{#if profile?.name}
							<span class="hidden max-w-[9rem] truncate text-sm text-ink md:block">{profile.name}</span>
						{/if}
					</button>

				{#if showSteamId}
					<!-- Floats over the page instead of expanding the nav, so nothing below
					     shifts when it opens. Width is capped to the viewport so it stays
					     fully on-screen down to ~320px wide. -->
					<div class="pop-in absolute right-0 top-[calc(100%+0.5rem)] w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-white/10 bg-steam-dark shadow-2xl shadow-black/60">
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
										<User class="h-5 w-5 text-ink-dim" />
									</span>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-semibold text-ink">{profile.name}</p>
									<p class="truncate text-xs text-ink-faint">{profile.steamId}</p>
								</div>
								{#if profile.visibility && profile.visibility !== '3'}
									<span class="shrink-0 rounded bg-yellow-900/50 px-2 py-1 text-[10px] text-yellow-300">Private</span>
								{/if}
							</div>
						{/if}

						<div class="p-3">
							<label for="steam-id" class="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-faint">
								Steam ID or vanity name
							</label>
							<div class="flex items-center gap-2 rounded-lg bg-steam-blue px-3 py-2 focus-within:ring-1 focus-within:ring-steam-accent/60">
								<User class="h-4 w-4 shrink-0 text-ink-faint" />
								<input
									id="steam-id"
									type="text"
									inputmode="numeric"
									autocomplete="off"
									spellcheck="false"
									placeholder="76561198… or profile URL"
									class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
									bind:value={steamId}
									oninput={saveSteamId}
									onkeydown={(e) => { if (e.key === 'Enter') commitSteamId(); }}
								/>
							</div>

							{#if profileError}
								<p class="mt-2 text-xs text-red-400">{profileError}</p>
							{:else if steamId.trim() && !profile && !refreshingProfile}
								<p class="mt-2 truncate text-xs text-ink-faint">Connected: {steamId}</p>
							{/if}

							<div class="mt-3 flex items-center gap-2">
								<button
									class="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-steam-accent px-3 text-sm font-semibold text-accent-ink active:bg-steam-accent/80 disabled:opacity-50"
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
										class="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-steam-blue px-3 text-sm text-ink-dim active:bg-steam-light"
									>
										<ExternalLink class="h-4 w-4" />
										Profile
									</a>
								{/if}
							</div>
						</div>

						<!--
							Appearance, below the account block and separated by a rule.

							Placed inside the existing popover rather than given its own
							navbar button: it is a low-frequency preference, the navbar is
							already at its tap-target minimum on a phone, and the popover
							floats above the page so adding a section never reflows anything.
						-->
						<div class="border-t border-white/5 p-3">
													<div class="mb-2 flex items-baseline justify-between gap-2">
														<p class="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
															Theme
														</p>
														<p class="truncate text-[11px] text-ink-faint">
															{THEMES.find((t) => t.id === theme)?.label}
														</p>
													</div>
													<ThemePicker {theme} onchange={setTheme} />
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
