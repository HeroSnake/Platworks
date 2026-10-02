<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ArrowUp, Search, Filter, RefreshCw, Loader2, X } from '@lucide/svelte';

	let {
		percent,
		primary,
		secondary,
		status = null,
		statusTone = 'ok',
		syncing = false,
		onsync,
		searchPlaceholder = 'Search…',
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
		query?: string;
		onsearch?: (q: string) => void;
		/** Filter row contents. The filter button is hidden when omitted. */
		panel?: Snippet;
	} = $props();

	// Search and filter are mutually exclusive — a single expanded row keeps the bar
	// short enough to leave room for the achievement list behind it.
	let mode = $state<'none' | 'search' | 'filter'>('none');
	let searchEl = $state<HTMLInputElement | null>(null);

	function toggle(next: 'search' | 'filter') {
		mode = mode === next ? 'none' : next;
		// Focus after the row exists so mobile browsers raise the keyboard straight away.
		if (mode === 'search') requestAnimationFrame(() => searchEl?.focus());
	}

	function clearSearch() {
		query = '';
		onsearch?.('');
	}
</script>

<div class="fixed-bottom-bar fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-steam-dark/95 backdrop-blur-md sm:hidden">
	<!-- Animated via grid-template-rows so the list underneath never re-lays-out. -->
	<div class="expand-panel" data-open={mode !== 'none'}>
		<div>
			<div class="px-4 py-2.5">
				{#if mode === 'search'}
					<div class="flex items-center gap-2 rounded-lg bg-steam-blue px-3 py-2">
						<Search class="h-4 w-4 shrink-0 text-gray-500" />
						<!-- text, not search: avoids WebKit's own clear button colliding with ours. -->
						<input
							bind:this={searchEl}
							bind:value={query}
							oninput={() => onsearch?.(query)}
							type="text"
							enterkeyhint="search"
							autocomplete="off"
							spellcheck="false"
							placeholder={searchPlaceholder}
							aria-label={searchPlaceholder}
							class="min-w-0 flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
						/>
						{#if query}
							<button
								class="-mr-1 shrink-0 rounded p-0.5 text-gray-500 active:text-white"
								onclick={clearSearch}
								aria-label="Clear search"
							>
								<X class="h-4 w-4" />
							</button>
						{/if}
					</div>
				{:else if panel}
					{@render panel()}
				{/if}
			</div>
		</div>
	</div>

	{#if status}
		<div class="border-b border-white/5 px-4 py-1.5 text-center text-xs {statusTone === 'error' ? 'text-red-400' : 'text-green-400'}">
			{status}
		</div>
	{/if}

	<div class="flex items-center gap-2 px-4 py-2.5">
		<div class="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
			<div class="relative h-9 w-9 shrink-0">
				<svg class="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
					<circle cx="18" cy="18" r="15.5" fill="none" stroke-width="3" class="stroke-steam-light" />
					<!-- `stroke` is deliberately left out of the transition: this flips with
					     every check, and animating the colour would repaint the whole bar.
					     Green at 100% matches game_card.svelte's "Complete" state. -->
					<circle
						cx="18" cy="18" r="15.5" fill="none" stroke-width="3"
						stroke-dasharray={`${percent * 0.974} 100`}
						stroke-linecap="round"
						class="transition-[stroke-dasharray] duration-500 ease-out {percent === 100
							? 'stroke-green-400'
							: 'stroke-steam-accent'}"
					/>
				</svg>
				<span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">{percent}%</span>
			</div>
			<div class="min-w-0 overflow-hidden text-xs leading-tight">
				<span class="font-semibold text-gray-200">{primary}</span>
				<span class="block truncate text-gray-500">{secondary}</span>
			</div>
		</div>

		<!-- No transition-colors here: these flip often and repaint the bar. -->
		<button
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {mode === 'search' ? 'bg-steam-accent text-steam-dark' : 'bg-steam-blue text-gray-400'}"
			onclick={() => toggle('search')}
			aria-label="Search"
			aria-pressed={mode === 'search'}
		>
			<Search class="h-4 w-4" />
		</button>

		{#if panel}
			<button
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {mode === 'filter' ? 'bg-steam-accent text-steam-dark' : 'bg-steam-blue text-gray-400'}"
				onclick={() => toggle('filter')}
				aria-label="Filters"
				aria-pressed={mode === 'filter'}
			>
				<Filter class="h-4 w-4" />
			</button>
		{/if}

		<button
			class="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-steam-accent px-3 text-xs font-semibold text-steam-dark active:bg-steam-accent/80 disabled:opacity-50"
			onclick={onsync}
			disabled={syncing}
		>
			{#if syncing}<Loader2 class="h-4 w-4 animate-spin" />{:else}<RefreshCw class="h-4 w-4" />{/if}
			Sync
		</button>

		<button
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-steam-blue text-gray-400 active:text-white"
			onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
			aria-label="Back to top"
		>
			<ArrowUp class="h-4 w-4" />
		</button>
	</div>
</div>
