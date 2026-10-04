<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { THEMES, type ThemeId } from '#lib/client/theme';

	let {
		theme,
		onchange
	}: {
		theme: ThemeId;
		onchange: (id: ThemeId) => void;
	} = $props();
</script>

<!--
	A radio group, not a set of buttons: it is a single choice out of N, and
	`role="radiogroup"` + `aria-checked` gives screen readers the right
	announcement. Clicking is the only interaction — the swatch carries the
	colour and the label carries the name, so neither is the sole signal.
-->
<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour theme">
	{#each THEMES as t (t.id)}
		<button
			type="button"
			role="radio"
			aria-checked={theme === t.id}
			title={t.label}
			onclick={() => onchange(t.id)}
			class="group flex min-h-10 items-center gap-2 rounded-lg border px-2.5 pr-3 text-xs font-medium transition-colors {theme === t.id
				? 'border-steam-accent bg-steam-accent/10 text-ink'
				: 'border-line bg-steam-blue text-ink-dim hover:text-ink'}"
		>
			<!--
				Two stacked colours: the page background behind, the accent in front.
				One swatch cannot show a palette — every one of them is a dark base
				plus an accent, and showing only the accent makes them look identical.
			-->
			<span
				class="relative h-5 w-5 shrink-0 overflow-hidden rounded border border-white/15"
				style:background={t.bg}
				aria-hidden="true"
			>
				<span class="absolute inset-x-0 bottom-0 h-1/2" style:background={t.swatch}></span>
			</span>
			{t.label}
			{#if theme === t.id}
				<Check class="h-3.5 w-3.5 text-steam-accent" />
			{/if}
		</button>
	{/each}
</div>
