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
		toggleMode = 'add',
			transitionName = undefined,
			onnavigate = undefined,
			onhover = undefined
		}: {
			game: GameListItem;
			completed: number;
			onToggle?: (appId: number) => void;
			toggleMode?: ToggleMode;
			/**
			 * A `view-transition-name` for this card's artwork.
			 *
			 * Supplied by the library page only for the card being activated, because the
			 * name must be UNIQUE among rendered elements: two elements sharing one name
			 * abort the whole transition and drop to the root cross-fade. The library page
			 * sets it on hover and clears it on `mouseleave`; `onnavigate` covers the two
			 * cases hover misses — a touch tap, and a keyboard user tabbing onto the card.
			 */
			transitionName?: string;
			/** Called on the card link's click and focus, so the page can name the art. */
			onnavigate?: (appId: number) => void;
			/** Called on pointer enter/leave of the card link, so the page can name the art. */
			onhover?: (appId: number, hovering: boolean) => void;
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

	THE MOTION LIVES ON `.pw-card-lift`, THE INNER WRAPPER, NOT ON THIS DIV.

	The card has to stay `position: relative` (the add/remove button is absolutely
	positioned into its top-right corner) and it has to stay un-transformed, because
	a `transform` on this element would be live for the whole of `:hover` and would
	also make it the containing block for every absolutely positioned descendant.
	The lift wrapper carries the leap instead, and the card's own box — its geometry,
	its border, its hit area — never moves.
-->
<div
	class="pw-card group relative overflow-hidden rounded-xl border border-line bg-steam-blue"
>
	<a
		href="/game/{game.appId}"
		class="block after:absolute after:inset-0"
		onclick={() => onnavigate?.(game.appId)}
		onfocus={() => onnavigate?.(game.appId)}
			onmouseenter={() => onhover?.(game.appId, true)}
			onmouseleave={() => onhover?.(game.appId, false)}
		>
		<span class="pw-card-lift block">
			<div
				class="relative aspect-video bg-steam-light"
				style:view-transition-name={transitionName ?? 'none'}
			>
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

			<!--
				The hover sheen. Transform-only and painted on the lift wrapper, so it is
				NOT clipped by the artwork's `overflow: hidden` — it rides across the
				top-left corner of the card. `pointer-events: none` so it cannot eat a
				click on the link underneath it.
			-->
			<span class="pw-card-sheen" aria-hidden="true"></span>

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
		</span>
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
					: 'border-transparent bg-steam-accent text-accent-ink'}"
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
