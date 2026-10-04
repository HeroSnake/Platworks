<script lang="ts">
	import { Plus, Check, Minus, Star, Trophy } from '@lucide/svelte';
	import ProgressBar from '#lib/components/progress_bar.svelte';
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
	Rebuilt around a linear bar instead of the 112px ring.

	Two reasons, both measured rather than aesthetic:
	  1. At four-plus cards per row the eye compares bar *lengths* far faster than
	     ring arcs, so the ranking is readable at a glance.
	  2. The ring forced a min-h-48 card. That height is what broke the header
	     artwork's letterbox bars — the image edge stopped landing inside the
	     gradient's solid band and a hard line appeared across the card. Cropping
	     the header into a fixed 16:9 box makes that seam geometrically impossible.

	`object-cover` is now safe: the title is rendered as text directly beneath the
	art, so cropping a 460x215 header no longer removes the game's name. The old
	`object-contain object-top` existed only because the logo baked into the
	artwork was the sole identifier.

	The <a> and the library <button> are siblings, not nested: a <button> inside
	an <a> is invalid HTML and its clicks activate the link instead. The <a>'s
	::after stretches over the card so the whole thing stays one big tap target.
-->
<div
	class="group relative overflow-hidden rounded-xl border border-line bg-steam-blue transition-transform duration-150 will-change-transform active:scale-[0.98] sm:hover:-translate-y-0.5 sm:hover:border-steam-light"
>
	<a href="/game/{game.appId}" class="block after:absolute after:inset-0">
		<div class="relative aspect-video bg-steam-light">
			<!--
				Placeholder painted UNDER the artwork, always present.

				Two games in the catalogue (Aniimo, WARDOGS) have no Steam header at
				all — both CDN paths 404 — so `onerror` hides the <img>. Without this
				layer that left an empty flat rectangle that read as "broken". Painting
				it underneath also means a `loading="lazy"` image that has not started
				yet shows the placeholder instead of a blank slot.

				All four layers below are `absolute` with `z-index: auto`, so tree order
				decides: placeholder → image → scrim → badges.
			-->
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-steam-blue via-steam-blue to-steam-light"
				aria-hidden="true"
			>
				<Trophy class="h-8 w-8 text-ink-faint" />
				<span class="px-3 text-center text-[11px] font-medium text-ink-faint">No artwork</span>
			</div>
			{#if game.steam?.headerImage}
				<!-- Decorative: the h3 below carries the name.

				     Local path, so there is no CDN retry here: a failure means this
				     game has no header art, not that the first host was wrong. The
				     placeholder underneath takes over. -->
				<img
					src={game.steam.headerImage}
					alt=""
					loading="lazy"
					decoding="async"
					class="absolute inset-0 h-full w-full object-cover"
					onerror={(e) => {
						(e.currentTarget as HTMLImageElement).style.display = 'none';
					}}
				/>
			{/if}
			<!-- One soft scrim for the badge row. The old two-scrim gradient existed to
			     hide the letterbox seam, and there is no longer a seam to hide. -->
			<div class="absolute inset-0 bg-steam-dark/25" aria-hidden="true"></div>

			{#if game.steam?.metacriticScore}
				<span class="tabular absolute left-2 top-2 z-10 inline-flex min-h-6 items-center gap-1 rounded-md bg-steam-dark/70 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink backdrop-blur-sm">
					<Star class="h-3 w-3 fill-current text-yellow-400" />
					{game.steam.metacriticScore}
				</span>
			{/if}
		</div>

		<div class="px-3 py-2.5">
			<h3 class="truncate font-display text-sm font-semibold leading-tight tracking-tight text-ink">
				{game.name}
			</h3>
			<div class="mt-2">
				<ProgressBar percent={percent} height={5} label={`${completed}/${game.totalAchievements}`} />
			</div>
			<p class="tabular mt-1.5 font-mono text-[11px] {percent === 100 ? 'text-steam-green' : 'text-ink-faint'}">
				{percent === 100 ? 'Complete' : `${percent}% complete`}
			</p>
		</div>
	</a>

	<!--
		The button is a 40px hit area with NO visual of its own; the 28px chip inside
		carries every bit of styling.

		They used to be the same element. The button is 40px and sits at
		`-right-1 -top-1` to grow the tap target past the artwork, so putting the
		background on it painted a 40px solid square that the card's
		`overflow-hidden` then clipped into an L-shape over the top-right corner.

		`rounded-lg` on the button only matters as a hit-area shape. The visible
		edge is the chip's own `rounded-md`.
	-->
	{#if onToggle}
		<button
			type="button"
			class="absolute -right-1 -top-1 z-10 flex h-10 w-10 items-center justify-center rounded-lg"
			onclick={() => onToggle(game.appId)}
			aria-label={toggleLabel}
			title={toggleLabel}
			aria-pressed={toggleMode !== 'add'}
		>
			<span
				class="flex h-7 w-7 items-center justify-center rounded-md border backdrop-blur-sm transition-colors {toggleMode === 'add'
					? 'border-white/15 bg-steam-dark/60 text-ink hover:bg-steam-dark/85'
					: 'border-transparent bg-steam-accent text-steam-dark'}"
			>
				{#if toggleMode === 'add'}
					<Plus class="h-4 w-4" />
				{:else if toggleMode === 'added'}
					<Check class="h-4 w-4" />
				{:else}
					<Minus class="h-4 w-4" />
				{/if}
			</span>
		</button>
	{/if}
</div>
