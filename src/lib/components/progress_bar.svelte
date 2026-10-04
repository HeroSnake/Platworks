<script lang="ts">
	/**
	 * Linear completion bar — the default progress indicator across the app.
	 *
	 * Preferred over `progress_ring.svelte` wherever several sit side by side:
	 * bar lengths are compared far faster than ring arcs, and the height is fixed
	 * so it cannot reflow the row it lives in.
	 *
	 * The fill animates via `transform: scaleX`, not `width`, so the browser
	 * composites it instead of running layout on every frame of the transition.
	 */
	let {
		percent,
		height = 5,
		label = undefined,
		track = 'bg-steam-light'
	}: {
		percent: number;
		height?: number;
		/** Optional trailing text, e.g. "18/42". Rendered outside the track. */
		label?: string;
		track?: string;
	} = $props();

	let clamped = $derived(Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0)));
</script>

<div class="flex items-center gap-2">
	<div
		class="w-full overflow-hidden rounded-full {track}"
		style:height="{height}px"
		role="progressbar"
		aria-valuenow={clamped}
		aria-valuemin="0"
		aria-valuemax="100"
	>
		<div
			class="h-full w-full origin-left rounded-full transition-transform duration-500 ease-out {clamped === 100
				? 'bg-steam-green'
				: 'bg-steam-accent'}"
			style:transform="scaleX({clamped / 100})"
		></div>
	</div>
	{#if label}
		<span class="tabular shrink-0 font-mono text-xs text-ink-faint">{label}</span>
	{/if}
</div>
