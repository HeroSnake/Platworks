<script lang="ts">
	import { Lock, Trophy } from '@lucide/svelte';
	import SegmentedControl from '#lib/components/segmented_control.svelte';
	import SearchField from '#lib/components/search_field.svelte';

	/**
	 * The game page's filter row — one component, rendered once.
	 *
	 * This previously existed twice: once in the page body and again inside the
	 * mobile bar's `panel` snippet, each hidden at the opposite breakpoint. That
	 * is how "Filter by type" ended up rendered twice on a phone, and why the map
	 * link appeared twice on a tablet. Two copies of a control drift — this one
	 * had already drifted into different heights, different labels and a
	 * different set of options.
	 *
	 * The mobile bar is now a single row (search / filter / sync) and its filter
	 * toggle scrolls this component into view, so exactly one filter UI is on
	 * screen at any width.
	 */
	let {
		filter = $bindable(),
		typeFilter = $bindable(),
		gameSort = $bindable(),
		query = $bindable(''),
		completionFilterOptions,
		types,
		typeCounts
	}: {
		filter: 'all' | 'locked' | 'unlocked';
		typeFilter: string;
		gameSort: 'default' | 'name' | 'difficulty';
		query: string;
		completionFilterOptions: Array<{
			value: string;
			label: string;
			icon?: typeof Lock;
			count?: number;
		}>;
		types: string[];
		typeCounts: Record<string, number>;
	} = $props();
</script>

<div class="flex flex-col gap-2">
	<!--
		One scrollable row rather than a wrapping one. `flex-wrap` would let the
		search field drop to its own line on a narrow phone and push the list down
		by a row's height; `overflow-x-auto` keeps the toolbar a fixed height and
		makes the extra options reachable by swiping.
	-->
	<div class="scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1">
		<SegmentedControl bind:value={filter} label="Completion filter" size="sm" options={completionFilterOptions} />
		<!--
			Search is the one control hidden below `sm`. The mobile bar already
			carries a search field in the thumb zone, and in a horizontally scrolling
			row it would be pushed off-screen anyway. One search box per breakpoint.
		-->
		<div class="hidden min-w-[9rem] flex-1 sm:block">
			<SearchField bind:query placeholder="Search trophies…" label="Search trophies" />
		</div>
		<!--
			Sort is the only <select> left. There used to be a second one for the
			achievement type, which duplicated the chip row directly beneath it: the
			same filter, in the same toolbar, one control apart — and the chips carry
			counts and a `missable` icon, so they were always the better one. "All
			types" is now simply the state where no chip is pressed, and each chip
			toggles itself off on a second tap.

			Dropping it also buys the sort control room to stop being the thing pushed
			off the right edge of a phone.
		-->
		<select
			class="h-10 shrink-0 rounded-lg border border-line bg-steam-blue px-2.5 text-xs text-ink outline-none"
			bind:value={gameSort}
			aria-label="Sort trophies"
		>
			<option value="default">Default</option>
			<option value="name">A–Z</option>
			<option value="difficulty">Difficulty</option>
		</select>
	</div>

	<!--
		Type chips, exposed rather than hidden in the <select>. Each carries its own
		count so a chip is never a dead tap. `standard` is the synthetic entry for
		untagged trophies.

		Rendered whenever the game has any tags at all - including a single one - so
		the control set keeps the same shape for every game and the toolbar never
		gains or loses a row. "All types" is the state where no chip is pressed, and
		each chip toggles itself off on a second tap.
	-->
	{#if types.length > 0}
		<div class="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
			{#each types as t (t)}
				<button
					type="button"
					class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors {typeFilter === t
						? 'border-steam-accent bg-steam-accent/15 text-steam-accent'
						: 'border-line bg-steam-blue text-ink-dim hover:text-ink'}"
					onclick={() => (typeFilter = typeFilter === t ? 'all' : t)}
					aria-pressed={typeFilter === t}
				>
					{#if t === 'missable'}<Trophy class="h-3 w-3" />{/if}
					{t[0].toUpperCase() + t.slice(1)}
					<span class="tabular font-mono text-[10px] opacity-70">{typeCounts[t] ?? 0}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
