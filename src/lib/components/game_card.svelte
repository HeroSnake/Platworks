<script lang="ts">
	import { Trophy, Star, ChevronRight, CheckCircle } from '@lucide/svelte';
	import type { GameListItem } from '../../routes/+page.server';

	let { game, completed } = $props<{ game: GameListItem; completed: number }>();

	let percent = $derived(game.totalAchievements > 0 ? Math.round((completed / game.totalAchievements) * 100) : 0);
	let isComplete = $derived(completed === game.totalAchievements && completed > 0);
</script>

<!-- Mobile: horizontal card. Desktop: vertical card -->
<a
	href="/game/{game.appId}"
	class="group flex overflow-hidden rounded-xl bg-steam-blue will-change-transform active:scale-[0.98] sm:flex-col sm:hover:scale-[1.02] sm:hover:shadow-xl transition-transform duration-150"
>
	<!-- Image -->
	{#if game.steam?.headerImage}
		<img
			src={game.steam.headerImage}
			alt={game.name}
			class="h-24 w-28 shrink-0 object-cover sm:h-40 sm:w-full"
		/>
	{:else}
		<div class="flex h-24 w-28 shrink-0 items-center justify-center bg-steam-light sm:h-40 sm:w-full">
			<Trophy class="h-8 w-8 text-gray-500" />
		</div>
	{/if}

	<!-- Info -->
	<div class="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3 sm:gap-2 sm:p-4">
		<h2 class="truncate text-base font-semibold leading-tight group-hover:text-steam-accent sm:text-lg sm:whitespace-normal sm:truncate-none">
			{game.name}
		</h2>

		{#if game.steam?.shortDescription}
			<p class="hidden text-sm text-gray-400 sm:line-clamp-2">
				{game.steam.shortDescription}
			</p>
		{/if}

		<div class="sm:mt-auto sm:pt-2">
			<!-- Progress bar -->
			<div class="mb-1.5 h-1.5 overflow-hidden rounded-full bg-steam-light sm:h-2">
				<div
					class="h-full rounded-full transition-all duration-500 {isComplete ? 'bg-green-400' : 'bg-steam-accent'}"
					style:width="{percent}%"
				></div>
			</div>
			<div class="flex items-center gap-2 text-xs text-gray-400">
				{#if isComplete}
					<span class="flex items-center gap-1 font-semibold text-green-400">
						<CheckCircle class="h-3.5 w-3.5" />
						Complete
					</span>
				{:else}
					<span class="flex items-center gap-1">
						<Trophy class="h-3.5 w-3.5" />
						{completed}/{game.totalAchievements}
					</span>
					<span class="tabular-nums text-gray-500">{percent}%</span>
				{/if}

				{#if game.steam?.metacriticScore}
					<span class="ml-auto flex items-center gap-1 rounded bg-steam-green px-1.5 py-0.5 text-xs font-bold text-white">
						{game.steam.metacriticScore}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Mobile arrow -->
	<div class="flex items-center pr-3 sm:hidden">
		<ChevronRight class="h-5 w-5 text-gray-500" />
	</div>
</a>
