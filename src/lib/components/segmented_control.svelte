<script lang="ts">
	import type { Component } from 'svelte';

	/**
	 * Segmented control — a single choice out of a small fixed set.
	 *
	 * `role="radiogroup"` rather than a row of toggles: exactly one option is
	 * active at a time, and this is the semantic that tells a screen reader so.
	 *
	 * Deliberately scrollable on narrow screens instead of wrapping. A wrapping
	 * segmented control pushes the content below it down every time an option is
	 * added, which is the same class of bug as the library scope switcher that
	 * used to appear mid-gesture and shove the grid out from under the user's
	 * finger.
	 */
	let {
		options,
		value = $bindable(),
		label,
		size = 'md'
	}: {
		options: Array<{ value: string; label: string; icon?: Component; count?: number }>;
		value: string;
		label: string;
		size?: 'sm' | 'md';
	} = $props();
</script>

<!--
	`w-fit` is load-bearing. `display:flex` makes this a block-level box, so in a
	block parent it stretched the full page width; as a flex item in the toolbar it
	shrink-wraps. `w-fit` states that intent directly rather than relying on it
	being a flex item, so the control looks the same in either container.
-->
<div
	class="scrollbar-none flex w-fit max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-lg bg-steam-blue p-0.5"
	role="radiogroup"
	aria-label={label}
>
	{#each options as opt (opt.value)}
		{@const active = value === opt.value}
		<button
			type="button"
			role="radio"
			aria-checked={active}
			onclick={() => (value = opt.value)}
			class="flex shrink-0 items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors {size === 'sm'
				? 'h-10 px-2.5 text-xs'
				: 'h-10 px-3 text-sm'} {active
				? 'bg-steam-light font-semibold text-ink'
				: 'text-ink-dim hover:text-ink'}"
		>
			{#if opt.icon}
				{@const Icon = opt.icon}
				<Icon class="h-3.5 w-3.5 shrink-0" />
			{/if}
			{opt.label}
			{#if opt.count !== undefined}
				<span class="tabular font-mono text-[11px] text-ink-faint">{opt.count}</span>
			{/if}
		</button>
	{/each}
</div>
