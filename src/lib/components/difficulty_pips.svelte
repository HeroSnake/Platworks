<script lang="ts">
	/**
	 * Difficulty, shown as filled pips plus a text label.
	 *
	 * Never colour alone: the old rows printed "hard" in orange and nothing else,
	 * which is unreadable for colour-blind players and survives a screenshot as
	 * an anonymous orange word. The pip count carries the level (1-4 filled) and
	 * the label still names it, so both readings agree.
	 */
	let { difficulty }: { difficulty: 'easy' | 'medium' | 'hard' | 'very-hard' } = $props();

	const LEVEL: Record<string, number> = { easy: 1, medium: 2, hard: 3, 'very-hard': 4 };
	let filled = $derived(LEVEL[difficulty] ?? 1);
</script>

<span class="inline-flex items-center gap-1.5 align-middle" title="Difficulty: {difficulty}">
	<span class="inline-flex gap-0.5" role="img" aria-label="Difficulty: {difficulty}">
		{#each [1, 2, 3, 4] as pip (pip)}
			<span
				class="h-1.5 w-1.5 rounded-[1px] {pip <= filled
					? difficulty === 'easy'
						? 'bg-steam-green'
						: difficulty === 'medium'
							? 'bg-yellow-400'
							: 'bg-orange-400'
					: 'bg-steam-light'}"
			></span>
		{/each}
	</span>
	<span class="text-[11px] capitalize leading-none text-ink-faint">{difficulty}</span>
</span>
