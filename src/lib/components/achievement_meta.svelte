<script lang="ts">
	import { TriangleAlert, Users, Repeat, EyeOff } from '@lucide/svelte';
	import DifficultyPips from '#lib/components/difficulty_pips.svelte';
	import type { Achievement } from '#lib/types/game';

	/**
	 * The difficulty + tag rail shared by the trophy row and the desktop detail
	 * panel. Extracted so the two cannot drift: a new tag type is added in one
	 * place, and the row and the panel always agree on which trophies carry it.
	 *
	 * The border and spacing belong to the CALLER — the row draws its rail under a
	 * hairline inside the text column, the panel draws it across the panel — so
	 * this renders only the pips and the badges.
	 */
	let { achievement }: { achievement: Achievement } = $props();

	const typeIcons: Record<string, typeof TriangleAlert> = {
		missable: TriangleAlert,
		multiplayer: Users,
		cumulative: Repeat,
		secret: EyeOff
	};

	// Only `missable` earns an alarm colour; the rest are neutral so a row carrying
	// several tags doesn't turn into a wall of colour.
	const typeStyles: Record<string, string> = {
		missable: 'bg-red-500/15 text-red-300',
		multiplayer: 'bg-steam-light text-ink-dim',
		cumulative: 'bg-steam-light text-ink-dim',
		secret: 'bg-steam-light text-ink-dim'
	};
</script>

<div class="flex min-h-5 items-center gap-2">
	<DifficultyPips difficulty={achievement.difficulty} />
	{#if achievement.types.length}
		<span class="h-3 w-px shrink-0 bg-line" aria-hidden="true"></span>
		{#each achievement.types as tag (tag)}
			{@const Icon = typeIcons[tag]}
			{#if Icon}
				<span class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-tight {typeStyles[tag] ?? 'bg-steam-light text-ink-dim'}">
					<Icon class="h-3 w-3" />
					{tag}
				</span>
			{/if}
		{/each}
	{/if}
</div>
