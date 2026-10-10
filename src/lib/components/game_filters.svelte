<script lang="ts">
	import { Lock, Trophy } from '@lucide/svelte';
	import SegmentedControl from '#lib/components/segmented_control.svelte';
	import SearchField from '#lib/components/search_field.svelte';
	import FilterToolbar from '#lib/components/filter_toolbar.svelte';
	import FilterGroup from '#lib/components/filter_group.svelte';

	/**
	 * The game page's filter toolbar — one toolbar, rendered once.
	 *
	 * It shares `filter_toolbar.svelte` with the library page, so both pages read as
	 * one system: the same segmented control for sort (there is no `<select>`), the
	 * same wrap-and-caption behaviour, the same 40px controls.
	 *
	 * This previously existed twice — once in the page body and again inside the
	 * mobile bar's `panel` snippet — each hidden at the opposite breakpoint, which is
	 * how "Filter by type" ended up rendered twice on a phone. The mobile bar now
	 * carries search only and this component is the sole filter UI at every width.
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

	// Default / A–Z / Difficulty — the same segmented control the library uses for
	// sort, so the two toolbars share one control vocabulary.
	const sortOptions = [
		{ value: 'default', label: 'Default' },
		{ value: 'name', label: 'A–Z' },
		{ value: 'difficulty', label: 'Difficulty' }
	];
</script>

<FilterToolbar name="game">
	<FilterGroup label="Show">
		<SegmentedControl bind:value={filter} label="Completion filter" size="sm" options={completionFilterOptions} />
	</FilterGroup>

	<!--
		Type chips, exposed rather than hidden in a control. Each carries its own
		count so a chip is never a dead tap. `standard` is the synthetic entry for
		untagged trophies. Rendered whenever the game has any tags at all — including
		a single one — so the control set keeps the same shape for every game. "All
		types" is the state where no chip is pressed, and each chip toggles itself off
		on a second tap.
	-->
	{#if types.length > 0}
		<FilterGroup label="Type">
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
		</FilterGroup>
	{/if}

	<!--
		Search is the one control hidden below `sm`. The mobile bar already carries a
		search field in the thumb zone; the `contents` display keeps this group a
		direct flex item of the toolbar at `sm` and up, and removes it entirely below
		so its caption does not show over nothing.
	-->
	<div class="hidden sm:contents">
		<FilterGroup label="Search" grow>
			<SearchField bind:query placeholder="Search trophies…" label="Search trophies" />
		</FilterGroup>
	</div>

	<FilterGroup label="Order">
		<SegmentedControl bind:value={gameSort} label="Sort trophies" size="sm" options={sortOptions} />
	</FilterGroup>
</FilterToolbar>
