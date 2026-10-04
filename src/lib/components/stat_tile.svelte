<script lang="ts">
	/**
	 * A single headline figure.
	 *
	 * The old pages printed their main number as muted body text in a line of
	 * spans — "12 games · 847/1994 · 42%" — which is technically the app's whole
	 * value proposition rendered as the least prominent thing on screen. These
	 * tiles give the totals an actual hierarchy.
	 */
	let {
		label,
		value,
		suffix = '',
		prefix = '',
		accent = false,
		title = undefined
	}: {
		label: string;
		value: string | number;
		suffix?: string;
		prefix?: string;
		/** Renders in the accent colour. Use for the one figure that leads. */
		accent?: boolean;
		title?: string;
	} = $props();
</script>

<div class="rounded-xl border border-line bg-steam-blue px-3.5 py-3" {title}>
	<p class="text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">{label}</p>
	<p class="tabular mt-1.5 font-mono text-2xl font-bold leading-none tracking-tight {accent ? 'text-steam-accent' : 'text-ink'}">
		{#if prefix}<span class="text-sm font-medium text-ink-faint">{prefix}</span>{/if}{value}{#if suffix}<span class="text-sm font-medium text-ink-faint">{suffix}</span>{/if}
	</p>
</div>
