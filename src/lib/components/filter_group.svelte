<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One labelled group inside `filter_toolbar.svelte` — a caption plus its controls.
	 *
	 * The caption is hidden while the toolbar is on one line and returns when it
	 * wraps, so a one-line toolbar carries no redundant labels. `grow` lets a group
	 * (the search field) take the leftover width on that line. The rules live in the
	 * `.pw-toolbar-label` block in `app.css`.
	 */
	let { label, grow = false, children }: { label: string; grow?: boolean; children: Snippet } = $props();
</script>

<div class="pw-toolbar-group" class:pw-toolbar-group--grow={grow}>
	<span class="pw-toolbar-label">{label}</span>
	{@render children()}
</div>
