<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The filter toolbar shared by the library and the game page.
	 *
	 * Plain wrap: it is one line whenever its groups fit and drops the groups to the
	 * next line when they do not. `name` picks which container width the group
	 * captions are keyed to — the game toolbar carries the achievement-type chips, so
	 * it stays labelled (and wrapping) far longer than the library's. The rules live
	 * in the `.pw-toolbar` block in `app.css`.
	 *
	 * The background pattern is masked behind the toolbar by the caller's `pw-quiet`
	 * wrapper, not here — one toolbar per page, so the wrapper stays at the call site.
	 */
	let { name, children }: { name: 'lib' | 'game'; children: Snippet } = $props();
</script>

<div class="pw-toolbar" data-toolbar={name}>
	<div class="pw-toolbar-groups">{@render children()}</div>
</div>
