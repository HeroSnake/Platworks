<script lang="ts">
	import { Trophy, Star, CheckCircle } from '@lucide/svelte';
	import type { GameListItem } from '../../routes/+page.server';

	let { game, completed } = $props<{ game: GameListItem; completed: number }>();

	let percent = $derived(game.totalAchievements > 0 ? Math.round((completed / game.totalAchievements) * 100) : 0);
	let isComplete = $derived(completed === game.totalAchievements && completed > 0);
</script>

<!-- Same display language as the game-page hero: full-bleed art, two scrims,
     title + chips sitting on the image — not a side thumbnail + text column. -->
<a
	href="/game/{game.appId}"
	class="group relative block min-h-40 overflow-hidden rounded-2xl bg-steam-blue will-change-transform active:scale-[0.98] sm:min-h-48 sm:hover:scale-[1.02] sm:hover:shadow-xl transition-transform duration-150"
>
	{#if game.steam?.headerImage}
		<!-- Decorative: the h2 carries the name. Sized slightly past the clip so
		     rounded corners never flash the steam-blue fill. -->
		<img
			src={game.steam.headerImage}
			alt=""
			class="absolute left-1/2 top-1/2 h-[106%] w-[106%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
			onerror={(e) => {
				// Akamai path 404s for some apps — one Cloudflare retry, then hide.
				const el = e.currentTarget as HTMLImageElement;
				if (el.dataset.fallback) {
					el.style.display = 'none';
					return;
				}
				el.dataset.fallback = '1';
				el.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/header.jpg`;
			}}
		/>
	{:else}
		<div class="absolute inset-0 flex items-center justify-center bg-steam-light">
			<Trophy class="h-10 w-10 text-gray-500" />
		</div>
	{/if}

	<!-- Two scrims, not one — same rule as game/[appId] hero -->
	<div class="absolute inset-0 bg-steam-dark/45" aria-hidden="true"></div>
	<div class="absolute inset-0 bg-gradient-to-t from-steam-dark via-steam-dark/85 to-transparent" aria-hidden="true"></div>

	<div class="relative flex min-h-40 flex-col justify-end px-3 pb-3 pt-16 sm:min-h-48 sm:px-4 sm:pb-4 sm:pt-20">
		<h2 class="truncate text-lg font-bold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] group-hover:text-steam-accent sm:text-xl">
			{game.name}
		</h2>

		{#if game.steam?.shortDescription}
			<p class="mt-1 hidden text-xs leading-snug text-gray-300 sm:line-clamp-2">
				{game.steam.shortDescription}
			</p>
		{/if}

		<div class="mt-2.5 flex flex-wrap items-center gap-1.5">
			{#if isComplete}
				<span class="inline-flex min-h-8 items-center gap-1 rounded bg-steam-light/90 px-2 py-1 text-xs font-semibold text-green-400">
					<CheckCircle class="h-3.5 w-3.5" />
					Complete
				</span>
			{:else}
				<span class="inline-flex min-h-8 items-center gap-1 rounded bg-steam-light/90 px-2 py-1 text-xs text-gray-200">
					<Trophy class="h-3.5 w-3.5 text-steam-accent" />
					{completed}/{game.totalAchievements}
					<span class="tabular-nums text-gray-400">{percent}%</span>
				</span>
			{/if}

			{#if game.steam?.metacriticScore}
				<span class="inline-flex min-h-8 items-center gap-1 rounded bg-steam-green px-2 py-1 text-xs font-bold text-white">
					<Star class="h-3.5 w-3.5" />
					{game.steam.metacriticScore}
				</span>
			{/if}
		</div>

		<!-- Compact progress under the chips (game page keeps the big bar outside the hero) -->
		<div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-steam-light/80">
			<div
				class="h-full rounded-full transition-all duration-500 {isComplete ? 'bg-green-400' : 'bg-steam-accent'}"
				style:width="{percent}%"
			></div>
		</div>
	</div>
</a>
