<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ArrowUp, Search, SlidersHorizontal, RefreshCw } from '@lucide/svelte';
	import ProgressRing from '#lib/components/progress_ring.svelte';
	import SearchField from '#lib/components/search_field.svelte';

	/**
	 * The mobile bottom bar, shared by both pages.
	 *
	 * Previously this rendered its own inline `<input>` and its own copy of the
	 * filter controls, duplicating the desktop toolbar a second time — two
	 * implementations of search and filter that could drift apart. It now
	 * composes `search_field.svelte` and takes the filter row as a snippet.
	 *
	 * Search and filter stay mutually exclusive so the bar only ever grows by one
	 * row. A bottom *sheet* was considered and rejected: the list behind it scrolls
	 * under an open sheet, and on a phone the sheet covers the exact rows the
	 * filter is meant to be narrowing.
	 */
	let {
		percent,
		primary,
		secondary,
		status = null,
		statusTone = 'ok',
		syncing = false,
		onsync,
		searchPlaceholder = 'Search…',
		searchLabel = 'Search',
		query = $bindable(''),
		onsearch,
		panel
	}: {
		percent: number;
		/** Bold figure beside the ring, e.g. "12/45". */
		primary: string;
		/** Muted line under it, e.g. "8 games" or "32 shown". */
		secondary: string;
		status?: string | null;
		statusTone?: 'ok' | 'error';
		syncing?: boolean;
		onsync?: () => void;
		searchPlaceholder?: string;
		searchLabel?: string;
		query?: string;
		onsearch?: (q: string) => void;
		/** Filter row contents. The filter button is hidden when omitted. */
		panel?: Snippet;
	} = $props();

	let mode = $state<'none' | 'search' | 'filter'>('none');

	function toggle(next: 'search' | 'filter') {
		mode = mode === next ? 'none' : next;
	}
</script>

<div class="fixed-bottom-bar fixed inset-x-0 bottom-0 z-50 border-t border-line bg-steam-dark/95 backdrop-blur-md sm:hidden">
	<!-- Animated via grid-template-rows so the list underneath never re-lays-out. -->
	<div class="expand-panel" data-open={mode !== 'none'}>
		<div>
			<div class="px-4 py-2">
				{#if mode === 'search'}
					<SearchField
						bind:query
						placeholder={searchPlaceholder}
						label={searchLabel}
						oninput={onsearch}
						autofocus
					/>
				{:else if panel}
					{@render panel()}
				{/if}
			</div>
		</div>
	</div>

	{#if status}
		<div class="border-b border-line px-4 py-1.5 text-center text-xs {statusTone === 'error' ? 'text-red-400' : 'text-steam-green'}">
			{status}
		</div>
	{/if}

	<div class="flex items-center gap-2 px-4 py-2.5">
		<!--
			`min-w-0` on the text block is load-bearing. Without it the flex item
			refuses to shrink below its text width, so the bar's content exceeds a
			390px viewport and gets clipped by the page's overflow — which reads as
			"cropped" rather than "overflowing".
		-->
		<div class="flex min-w-0 flex-1 items-center gap-2.5">
			<ProgressRing {percent} size={38} fontSize={9.5} strokeWidth={3.6} />
			<div class="min-w-0 overflow-hidden text-xs leading-tight">
				<span class="tabular block truncate font-semibold text-ink">{primary}</span>
				<span class="block truncate text-ink-faint">{secondary}</span>
			</div>
		</div>

		<!-- No transition-colors here: these flip often and repaint the bar. -->
		<button
			type="button"
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {mode === 'search'
				? 'bg-steam-accent text-steam-dark'
				: 'bg-steam-blue text-ink-dim'}"
			onclick={() => toggle('search')}
			aria-label="Search"
			aria-pressed={mode === 'search'}
		>
			<Search class="h-4 w-4" />
		</button>

		{#if panel}
			<button
				type="button"
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {mode === 'filter'
					? 'bg-steam-accent text-steam-dark'
					: 'bg-steam-blue text-ink-dim'}"
				onclick={() => toggle('filter')}
				aria-label="Filters"
				aria-pressed={mode === 'filter'}
			>
				<SlidersHorizontal class="h-4 w-4" />
			</button>
		{/if}

		{#if onsync}
			<button
				type="button"
				class="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-steam-accent px-3 text-xs font-semibold text-steam-dark active:bg-steam-accent/80 disabled:opacity-50"
				onclick={onsync}
				disabled={syncing}
			>
				{#if syncing}
					<RefreshCw class="h-4 w-4 animate-spin" />
				{:else}
					<RefreshCw class="h-4 w-4" />
				{/if}
				Sync
			</button>
		{/if}

		<button
			type="button"
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-steam-blue text-ink-dim active:text-ink"
			onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
			aria-label="Back to top"
		>
			<ArrowUp class="h-4 w-4" />
		</button>
	</div>
</div>
