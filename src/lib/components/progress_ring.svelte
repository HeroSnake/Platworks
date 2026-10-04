<script lang="ts">
	/**
	 * Circular completion indicator.
	 *
	 * Used only where the number deserves ceremony — the library total and the
	 * game-page header. Library *cards* use `progress_bar.svelte` instead: at four
	 * or more cards per row the eye compares bar lengths far faster than arcs, and
	 * a ring forces the card ~40% taller, which is what breaks the header-artwork
	 * scrim in `game_card.svelte`.
	 *
	 * `stroke` is deliberately NOT in the transition list. This re-renders on every
	 * check-off; animating the colour would repaint the whole component each time.
	 * Only `stroke-dasharray` transitions.
	 */
	let {
		percent,
		size = 28,
		fontSize = 9,
		strokeWidth = 3.4,
		label = undefined
	}: {
		percent: number;
		size?: number;
		fontSize?: number;
		strokeWidth?: number;
		/** Overrides the visible number; the percentage is still announced. */
		label?: string;
	} = $props();

	// Clamp: a corrupt localStorage entry must not produce a negative dash
	// length, which SVG renders as nothing at all.
	let clamped = $derived(Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0)));
	// Circumference of r=15.5 in this 36-unit viewBox, as a fraction of 100.
	const dash = (p: number) => ((p * 2 * Math.PI * 15.5) / 100).toFixed(2);
</script>

<div class="relative shrink-0" style:width="{size}px" style:height="{size}px">
	<svg width={size} height={size} viewBox="0 0 36 36" class="-rotate-90" aria-hidden="true">
		<circle cx="18" cy="18" r="15.5" fill="none" stroke-width={strokeWidth} class="stroke-steam-light" />
		<circle
			cx="18"
			cy="18"
			r="15.5"
			fill="none"
			stroke-width={strokeWidth}
			stroke-linecap="round"
			stroke-dasharray="{dash(clamped)} 100"
			class="transition-[stroke-dasharray] duration-500 ease-out {clamped === 100
				? 'stroke-steam-green'
				: 'stroke-steam-accent'}"
		/>
	</svg>
	<span
		class="tabular absolute inset-0 flex items-center justify-center font-bold leading-none text-ink"
		style:font-size="{fontSize}px"
	>
		{label ?? `${clamped}%`}
	</span>
</div>
