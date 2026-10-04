<script lang="ts">
	import { Trophy, Star, Plus, Check, Minus } from '@lucide/svelte';
	import type { GameListItem } from '../../routes/+page.server';

	/**
	 * `toggleMode` drives the library button, which only renders when the page passes
	 * `onToggle`. Three states rather than a boolean: in "My Library" every card is
	 * already selected, so a check would read as "all done" — it shows a minus
	 * instead, which reads as "take this one back out".
	 */
	type ToggleMode = 'add' | 'added' | 'remove';

	let {
		game,
		completed,
		onToggle,
		toggleMode = 'add'
	}: {
		game: GameListItem;
		completed: number;
		onToggle?: (appId: number) => void;
		toggleMode?: ToggleMode;
	} = $props();

	let percent = $derived(game.totalAchievements > 0 ? Math.round((completed / game.totalAchievements) * 100) : 0);

	let toggleLabel = $derived(
		toggleMode === 'add' ? `Add ${game.name} to my library` : `Remove ${game.name} from my library`
	);
</script>

<!--
	The card is dominated by the completion ring. Progression is the number this app
	exists to show, so the artwork is background, the blurb is gone entirely, and the
	ring carries both the percentage and the raw count inside it.

	The <a> and the library <button> are siblings, not nested: a <button> inside an
	<a> is invalid HTML and its clicks activate the link instead. The <a>'s ::after
	stretches over the card so the whole thing stays one big tap target.

	The wrapper is `bg-steam-dark`, NOT `bg-steam-blue`, and that is load-bearing:
	it is the colour that shows through where the contained image stops, so it has
	to match the solid end of the gradient below. Blue under a steam-dark gradient
	draws a hard horizontal line across the card.
-->
<div
	class="group relative overflow-hidden rounded-lg bg-steam-dark transition-transform duration-150 will-change-transform active:scale-[0.98] sm:hover:scale-[1.02] sm:hover:shadow-xl"
>
	<a href="/game/{game.appId}" class="block after:absolute after:inset-0">
		{#if game.steam?.headerImage}
			<!--
				Decorative: the h2 carries the name.

				`object-contain`, never `object-cover`. Steam headers are 460×215 and bake
				the game's logo into the artwork; filling a taller card with `cover` crops
				the sides off and takes the readable half of the logo with it.

				`object-top` pins the frame to the top edge, so when the card is taller
				than 460/215 *all* of the empty space collects at the bottom — underneath
				the overlay row and inside the gradient's solid band, where it cannot be
				seen. Centring would split the bars and leave a seam halfway up the art.
			-->
			<img
				src={game.steam.headerImage}
				alt=""
				class="absolute inset-0 h-full w-full object-contain object-top"
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

		<!--
			Two scrims, not one — same rule as game/[appId] hero. The flat pass stops a
			bright header washing out; the gradient carries the overlay row.

			`from-35%` is the load-bearing part. Everything in the bottom 35% is solid
			steam-dark, which is where the letterbox bars land at every breakpoint, so
			the image's lower edge dissolves into the background instead of terminating
			on a visible line. The remaining 65% is one long fade up to fully
			transparent, so the artwork is untouched at the top and there is no band to
			spot the seam in.

			Do not grow the card without re-checking that band. It is the one number
			holding the artwork edge invisible, and it is a percentage of a height that
			moves with the content.
		-->
		<div class="absolute inset-0 bg-steam-dark/45" aria-hidden="true"></div>
		<div class="absolute inset-0 bg-gradient-to-t from-steam-dark from-35% to-transparent" aria-hidden="true"></div>

		<!-- Metacritic lives in the corner so it cannot compete with the ring. -->
		{#if game.steam?.metacriticScore}
			<span class="absolute left-2 top-2 z-10 inline-flex min-h-7 items-center gap-1 rounded bg-steam-green px-2 py-0.5 text-xs font-bold text-white sm:left-3 sm:top-3">
				<Star class="h-3.5 w-3.5" />
				{game.steam.metacriticScore}
			</span>
		{/if}

		<!--
			Ring on the left, title beside it. Side-by-side rather than stacked on
			purpose: stacking a 112px ring above the title made the card tall enough
			that the letterbox bars grew taller than the gradient's solid band, and the
			artwork edge became visible again. Beside the title the card stays short.
		-->
		<div class="relative flex min-h-40 items-center gap-3 px-3 pb-3 pt-14 sm:min-h-48 sm:gap-4 sm:px-4 sm:pb-4 sm:pt-16">
			<div class="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
				<svg class="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
					<circle cx="18" cy="18" r="15.5" fill="none" stroke-width="2.5" class="stroke-steam-light/70" />
					<!--
						`stroke` is deliberately left out of the transition (only
						`stroke-dasharray` animates) so a completion flip does not repaint
						the whole card. The 0.974 factor is the circumference of r=15.5 in
						this 36-unit viewBox.
					-->
					<circle
						cx="18" cy="18" r="15.5" fill="none" stroke-width="2.5"
						stroke-dasharray={`${percent * 0.974} 100`}
						stroke-linecap="round"
						class="transition-[stroke-dasharray] duration-500 ease-out {percent === 100
							? 'stroke-green-400'
							: 'stroke-steam-accent'}"
					/>
				</svg>

				<!-- Both numbers live in the middle of the ring: percentage over count. -->
				<div class="absolute inset-0 flex flex-col items-center justify-center">
					<span class="text-xl font-bold leading-none tabular-nums text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-2xl">
						{percent}%
					</span>
					<span class="mt-1 text-[11px] font-medium tabular-nums text-gray-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
						{completed}/{game.totalAchievements}
					</span>
				</div>
			</div>

			<h2 class="min-w-0 flex-1 text-lg font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] group-hover:text-steam-accent sm:text-xl">
				{game.name}
			</h2>
		</div>
	</a>

	<!--
		Overlays the artwork's top-right corner. The card's `pt-14`/`sm:pt-16` reserves
		the band it and the Metacritic chip sit in. Absolute at every breakpoint: the
		card is full-bleed and has no mobile/desktop split to key off.
	-->
	{#if onToggle}
		<button
			class="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-md {toggleMode === 'add'
				? 'bg-steam-dark/80 text-gray-200 backdrop-blur-sm'
				: 'bg-steam-accent text-steam-dark'}"
			onclick={() => onToggle(game.appId)}
			aria-label={toggleLabel}
			title={toggleLabel}
		>
			{#if toggleMode === 'add'}
				<Plus class="h-5 w-5" />
			{:else if toggleMode === 'added'}
				<Check class="h-5 w-5" />
			{:else}
				<Minus class="h-5 w-5" />
			{/if}
		</button>
	{/if}
</div>