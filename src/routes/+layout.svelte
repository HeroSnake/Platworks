<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Trophy, ArrowLeft, User } from '@lucide/svelte';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { browser } from '$app/environment';

	let { children } = $props();

	let isHome = $derived(page.url.pathname === '/');
	let isGamePage = $derived(page.url.pathname.startsWith('/game/'));
	let gameName = $derived(
		isGamePage ? ((page.data as any)?.steam?.name ?? (page.data as any)?.game?.name ?? '') : ''
	);
	let showSteamId = $state(false);
	let steamId = $state(browser ? (localStorage.getItem('platworks:steamId') ?? '') : '');

	function saveSteamId() {
		if (browser) localStorage.setItem('platworks:steamId', steamId);
	}

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		showSteamId = false;
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
	<meta name="theme-color" content="#171a21" />
	<meta property="og:title" content="PlatWorks" />
	<meta property="og:description" content="Break down Steam achievements into step-by-step guides, missable alerts, and progress tracking." />
	<meta property="og:type" content="website" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="PlatWorks" />
	<link rel="apple-touch-icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-steam-dark text-gray-100">
	<nav class="sticky top-0 z-50 border-b border-white/5 bg-steam-dark/80 backdrop-blur-md">
		<div class="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
			{#if !isHome}
				<a href="/" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 active:text-white sm:hidden">
					<ArrowLeft class="h-5 w-5" />
				</a>
			{/if}
			<a href="/" class="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight">
				<Trophy class="h-5 w-5 text-steam-accent" />
				<span class="text-base {isGamePage ? 'hidden sm:inline' : ''}">PlatWorks</span>
			</a>
			{#if isGamePage && gameName}
				<span class="text-gray-500 sm:hidden">/</span>
				<span class="min-w-0 truncate text-sm text-gray-300 sm:hidden">{gameName}</span>
			{/if}

			<div class="ml-auto">
				<button
					class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 active:text-white {steamId ? 'text-steam-accent' : ''}"
					onclick={() => showSteamId = !showSteamId}
				>
					<User class="h-5 w-5" />
				</button>
			</div>
		</div>

		{#if showSteamId}
			<div class="border-t border-white/5 bg-steam-dark/95 px-4 py-2.5 backdrop-blur-md">
				<div class="mx-auto flex max-w-5xl items-center gap-2">
					<div class="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-steam-blue px-3 py-2">
						<User class="h-4 w-4 shrink-0 text-gray-500" />
						<input
							type="text"
							placeholder="Steam ID, vanity name, or profile URL"
							class="min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
							bind:value={steamId}
							oninput={saveSteamId}
							onkeydown={(e) => { if (e.key === 'Enter') showSteamId = false; }}
						/>
					</div>
					<button class="shrink-0 text-xs text-gray-400 active:text-white" onclick={() => showSteamId = false}>Done</button>
				</div>
				{#if steamId}
					<p class="mx-auto mt-1 max-w-5xl truncate text-xs text-gray-500">Connected: {steamId}</p>
				{/if}
			</div>
		{/if}
	</nav>

	<main>
		{@render children()}
	</main>
</div>
