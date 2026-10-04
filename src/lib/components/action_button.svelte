<script lang="ts">
	import type { Component } from 'svelte';
	import { Loader2 } from '@lucide/svelte';

	/**
	 * The app's button.
	 *
	 * Sync was previously copy-pasted across four call sites with three slightly
	 * different class strings, which is how a busy button ends up with no
	 * disabled treatment on one page and the wrong icon size on another.
	 *
	 * `disabled` also sets `aria-disabled` so the control still announces its
	 * state while `disabled` removes it from the focus order entirely — during a
	 * sync the button should stay discoverable, just inert.
	 */
	let {
		label,
		onclick,
		variant = 'primary',
		icon = undefined,
		loading = false,
		disabled = false,
		full = false,
		size = 'md'
	}: {
		label: string;
		onclick?: () => void;
		variant?: 'primary' | 'secondary';
		icon?: Component;
		loading?: boolean;
		disabled?: boolean;
		full?: boolean;
		size?: 'sm' | 'md';
	} = $props();

	let inert = $derived(disabled || loading);
</script>

<button
	type="button"
	onclick={onclick}
	disabled={inert}
	aria-disabled={inert}
	aria-busy={loading}
	class="flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 {size === 'sm'
		? 'h-9 px-3 text-xs'
		: 'h-10 px-4 text-sm'} {full ? 'w-full' : ''} {variant === 'primary'
		? 'bg-steam-accent text-steam-dark hover:bg-steam-accent/90'
		: 'border border-line bg-steam-blue text-ink hover:bg-steam-light'}"
>
	{#if loading}
		<Loader2 class="h-4 w-4 shrink-0 animate-spin" />
	{:else if icon}
		{@const Icon = icon}
		<Icon class="h-4 w-4 shrink-0" />
	{/if}
	{label}
</button>
