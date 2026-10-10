<script lang="ts">
	import { TriangleAlert, Video, ExternalLink, MessageCircle } from '@lucide/svelte';
	import type { Achievement } from '#lib/types/game';

	/**
	 * The guide body shared by the trophy row's inline expansion and the desktop
	 * detail panel. Extracted so the two render byte-for-byte the same steps,
	 * links, warnings and notes — the previous inline copy would have had to be
	 * kept in step by hand.
	 *
	 * Only the CONTENT is here. Whoever renders it owns the border and padding:
	 * the row indents it to the text column, the panel gives it the full width.
	 *
	 * The guide links are `min-h-10` at every width. They used to shrink to
	 * `sm:min-h-0`, which was invisible only because the guide was collapsed
	 * during audits — the panel shows them by default on desktop, so they hold the
	 * app's 40px floor now.
	 */
	let { achievement, unlockTime = null }: { achievement: Achievement; unlockTime?: Date | null } = $props();
</script>

<ol class="mb-3 space-y-2 text-sm">
	{#each achievement.guide.steps as step, i}
		<li class="flex gap-2.5">
			<span class="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-steam-light font-mono text-[11px] font-bold text-ink-dim">
				{i + 1}
			</span>
			<span class="text-ink-dim">{step}</span>
		</li>
	{/each}
</ol>

{#if achievement.guide.videoUrl || achievement.guide.sourceUrl}
	<div class="mb-3 flex flex-wrap gap-2">
		{#if achievement.guide.videoUrl}
			<a
				href={achievement.guide.videoUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-steam-light px-3 text-xs font-medium text-ink hover:bg-steam-light/80"
			>
				<Video class="h-3.5 w-3.5" />
				Video Guide
			</a>
		{/if}
		{#if achievement.guide.sourceUrl}
			<a
				href={achievement.guide.sourceUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-steam-light px-3 text-xs font-medium text-ink hover:bg-steam-light/80"
			>
				<ExternalLink class="h-3.5 w-3.5" />
				Written Guide
			</a>
		{/if}
	</div>
{/if}

{#if achievement.guide.warnings?.length}
	<div class="mb-3 space-y-1.5">
		{#each achievement.guide.warnings as warning}
			<div class="flex items-start gap-2 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-300 sm:text-sm">
				<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
				<span>{warning}</span>
			</div>
		{/each}
	</div>
{/if}

{#if achievement.guide.communityNotes?.length}
	<div class="space-y-1.5">
		{#each achievement.guide.communityNotes as note}
			<div class="flex items-start gap-2 text-xs text-ink-dim sm:text-sm">
				<MessageCircle class="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
				<span>{note}</span>
			</div>
		{/each}
	</div>
{/if}

{#if unlockTime}
	<p class="mt-3 text-xs text-ink-faint">
		Unlocked {unlockTime.toLocaleDateString()}
	</p>
{/if}
