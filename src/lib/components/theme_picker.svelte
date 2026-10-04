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

	/**
	 * Roving arrow-key navigation, which is what makes this a radio group rather
	 * than six buttons. Only the checked tile is tabbable (see `tabindex` below),
	 * and Arrow / Home / End move focus *and* select. Left/Right wrap because there
	 * is no tabbable element outside the group to escape to.
	 */
	function onkeydown(e: KeyboardEvent, index: number) {
		const last = THEMES.length - 1;
		const map: Record<string, number> = {
			ArrowRight: index === last ? 0 : index + 1,
			ArrowDown: index === last ? 0 : index + 1,
			ArrowLeft: index === 0 ? last : index - 1,
			ArrowUp: index === 0 ? last : index - 1,
			Home: 0,
			End: last
		};
		const next = map[e.key];
		if (next === undefined) return;
		e.preventDefault();
		onchange(THEMES[next].id);
		document.getElementById(`theme-tile-${THEMES[next].id}`)?.focus();
	}
</script>

<!--
	A radio group, not a set of buttons: it is a single choice out of N, and
	`role="radiogroup"` + `aria-checked` gives screen readers the right
	announcement. Clicking is the only pointer interaction — the tile carries the
	palette and the label carries the name, so neither is the sole signal.

	A 3-column grid, not a wrapping row. Six palettes in `flex-wrap` produced rows
	of 3/2/1, so the block was only as wide as its widest row and the popover
	juggled the selection sideways whenever it re-laid out. A fixed grid is stable
	at every width and still reads as two tidy rows down to a 320px screen.
-->
<div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Colour theme">
	{#each THEMES as t, i (t.id)}
		{@const selected = theme === t.id}
		<button
			type="button"
			role="radio"
			id="theme-tile-{t.id}"
			aria-checked={selected}
			tabindex={selected ? 0 : -1}
			title="{t.label} — {t.blurb}"
			onclick={() => onchange(t.id)}
			onkeydown={(e) => onkeydown(e, i)}
			class="group relative flex min-h-16 flex-col overflow-hidden rounded-lg border text-left transition-colors {selected
				? 'border-steam-accent bg-steam-accent/10'
				: 'border-line bg-steam-blue hover:border-ink-faint hover:bg-steam-light'}"
		>
			<!--
				The palette preview: page background, a raised surface card, an accent
				bar and a completion bar. A single swatch cannot show a palette —
				every one of them is a dark base plus an accent, and showing only the
				accent makes them look identical. The miniature card is what separates
				Ember from Amber at a glance, both of which read as "orange on dark".

				Both bars sit along the bottom INSIDE the card. The check badge is
				absolutely positioned at the *tile's* top-right, so anything at that
				corner collides with it — the preview dot and the check were drawn on
				top of each other and read as a single blob.
			-->
			<span
				class="relative block h-9 w-full shrink-0 border-b border-white/5"
				style:background={t.bg}
				aria-hidden="true"
			>
				<span class="absolute inset-x-1.5 bottom-1.5 top-1.5 rounded-[3px] bg-white/8"></span>
				<span class="absolute bottom-2.5 left-2.5 h-[3px] w-8 rounded-full" style:background={t.swatch}></span>
				<span class="absolute bottom-2.5 right-2.5 h-[3px] w-3 rounded-full" style:background={t.success}></span>
			</span>

			<span class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2 py-1.5">
				<span
					class="truncate text-xs font-medium {selected
						? 'text-ink'
						: 'text-ink-dim group-hover:text-ink'}"
				>
					{t.label}
				</span>
				<span class="truncate text-[10px] uppercase tracking-wide text-ink-faint">{t.blurb}</span>
			</span>

			{#if selected}
				<Check class="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-steam-accent" aria-hidden="true" />
			{/if}
		</button>
	{/each}
</div>