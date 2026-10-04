<script lang="ts">
	import { Search, X } from '@lucide/svelte';

	/**
	 * The one search input in the app.
	 *
	 * Both pages previously rendered a desktop input *and* a separate copy inside
	 * the mobile bar's expanding panel — two implementations of the same control
	 * that could drift apart. Both now render this component and bind `query`.
	 *
	 * `type="text"` rather than `type="search"` on purpose: WebKit draws its own
	 * clear button inside the field, which then collides with ours.
	 */
	let {
		query = $bindable(''),
		placeholder,
		label,
		oninput = undefined,
		autofocus = false
	}: {
		query: string;
		placeholder: string;
		label: string;
		oninput?: (q: string) => void;
		autofocus?: boolean;
	} = $props();

	let input = $state<HTMLInputElement | null>(null);

	// Only steal focus when explicitly asked (the mobile bar opens straight into
	// search). Never on mount: a page that autofocuses on load yanks the viewport
	// to the keyboard and hides the content the user came for.
	$effect(() => {
		if (autofocus) input?.focus();
	});

	function clear() {
		query = '';
		oninput?.('');
	}
</script>

<div class="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-steam-blue px-3 focus-within:ring-1 focus-within:ring-steam-accent/60">
	<Search class="h-4 w-4 shrink-0 text-ink-faint" />
	<!-- svelte-ignore a11y_autofocus -->
	<input
		bind:this={input}
		bind:value={query}
		oninput={() => oninput?.(query)}
		type="text"
		autocomplete="off"
		spellcheck="false"
		enterkeyhint="search"
		{placeholder}
		aria-label={label}
		class="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
	/>
	{#if query}
		<button
			type="button"
			class="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-faint hover:text-ink"
			onclick={clear}
			aria-label="Clear search"
		>
			<X class="h-4 w-4" />
		</button>
	{/if}
</div>
