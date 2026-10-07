<script lang="ts">
	import { countUp } from '#lib/client/countup';

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
		title = undefined,
		roll = false
	}: {
		label: string;
		value: string | number;
		suffix?: string;
		prefix?: string;
		/** Renders in the accent colour. Use for the one figure that leads. */
		accent?: boolean;
		title?: string;
		/**
		 * Roll the figure up from zero when it first scrolls into view.
		 *
		 * The roll belongs to this component rather than to the page, because it is a
		 * property of the FIGURE and not of the library: the game page's progress
		 * summary needs the same behaviour and it is not a stat tile. See
		 * `#lib/client/countup.ts` for why it is not a CSS transition.
		 *
		 * Ignored when `value` is not a plain number — a caller passing a formatted
		 * string has no integer to roll to, and a half-rolled "1,204" is worse than a
		 * static one.
		 */
		roll?: boolean;
	} = $props();

	let numberEl = $state<HTMLElement | null>(null);
	let rollable = $derived(roll && typeof value === 'number' && Number.isFinite(value));

	$effect(() => {
		// Read both so a caller changing either re-runs the roll rather than leaving
		// the previous number on screen.
		if (!rollable || !numberEl) return;
		countUp(numberEl, value as number, { onVisible: true });
	});
</script>

<div class="rounded-xl border border-line bg-steam-blue px-3.5 py-3" {title}>
	<p class="text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">{label}</p>
	<p class="tabular mt-1.5 font-mono text-2xl font-bold leading-none tracking-tight {accent ? 'text-steam-accent' : 'text-ink'}">
		{#if prefix}<span class="text-sm font-medium text-ink-faint">{prefix}</span>{/if}{#if rollable}<span bind:this={numberEl}>{value}</span>{:else}{value}{/if}{#if suffix}<span class="text-sm font-medium text-ink-faint">{suffix}</span>{/if}
	</p>
</div>
