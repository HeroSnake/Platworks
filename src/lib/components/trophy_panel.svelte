<script lang="ts">
	import { CircleCheckBig, Circle, Trophy } from '@lucide/svelte';
	import AchievementMeta from '#lib/components/achievement_meta.svelte';
	import AchievementGuide from '#lib/components/achievement_guide.svelte';
	import type { Achievement } from '#lib/types/game';

	/**
	 * The desktop detail panel for the game page's card grid.
	 *
	 * It is the detail half of a master–detail split: the grid of cards is the
	 * master and this shows the selected trophy's guide. It exists so a card can
	 * stay a fixed, even height — the guide lives here, not inside a 210px card,
	 * which is what keeps the grid's repeated rhythm intact and gives the prose a
	 * readable measure.
	 *
	 * It is rendered once by the page, at `lg` and up only; below `lg` the row's
	 * own inline expansion is the guide surface. `achievement` is null when nothing
	 * is selected, which draws the prompt rather than an empty panel.
	 */
	let {
		achievement,
		achieved,
		steamLocked,
		unlockTime = null,
		ontoggle
	}: {
		achievement: Achievement | null;
		achieved: boolean;
		steamLocked: boolean;
		unlockTime?: Date | null;
		ontoggle: () => void;
	} = $props();

	const toggleLabel = $derived(
		achievement
			? steamLocked
				? `${achievement.name} — unlocked on Steam`
				: achieved
					? `Mark ${achievement.name} as not done`
					: `Mark ${achievement.name} as done`
			: ''
	);
</script>

<aside
	class="overflow-hidden rounded-xl border border-line bg-steam-blue"
	aria-label="Trophy details"
>
	{#if achievement}
		<div class="flex items-start gap-3 border-b border-line p-3.5">
			<button
				type="button"
				class="pw-press relative shrink-0 {steamLocked ? 'is-locked' : ''}"
				onclick={ontoggle}
				disabled={steamLocked}
				aria-pressed={achieved}
				aria-label={toggleLabel}
				title={steamLocked ? 'Unlocked on Steam' : achieved ? 'Mark as not done' : 'Mark as done'}
			>
				<span class="relative block h-16 w-16">
					{#if achievement.iconUrl}
						<img
							src={achievement.iconUrl}
							alt=""
							width="64"
							height="64"
							class="h-16 w-16 rounded-lg object-cover transition-[filter,opacity] duration-200 {achieved
								? 'opacity-100 ring-2 ring-steam-green/50'
								: 'opacity-55 grayscale ring-1 ring-white/10'}"
						/>
					{:else}
						<span class="flex h-16 w-16 items-center justify-center rounded-lg bg-steam-light ring-1 ring-white/10">
							<Trophy class="h-7 w-7 text-ink-faint" />
						</span>
					{/if}
					<span class="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-steam-dark ring-2 ring-steam-dark">
						{#if achieved}
							<CircleCheckBig class="h-5 w-5 text-steam-green" />
						{:else}
							<Circle class="h-5 w-5 text-ink-faint" />
						{/if}
					</span>
				</span>
			</button>

			<div class="min-w-0 flex-1">
				<h2 class="text-[15px] font-semibold leading-tight text-ink" aria-live="polite">
					{achievement.name}
				</h2>
				<p class="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-dim">
					{achievement.description}
				</p>
			</div>
		</div>

		<div class="flex items-center gap-3 border-b border-line px-3.5 py-2.5">
			<AchievementMeta {achievement} />
			<span class="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">
				{achieved ? 'Unlocked' : 'Locked'}
			</span>
		</div>

		<div class="max-h-[60vh] overflow-y-auto p-3.5">
			<AchievementGuide {achievement} {unlockTime} />
		</div>
	{:else}
		<div class="flex flex-col items-center gap-2 px-4 py-12 text-center">
			<Trophy class="h-8 w-8 text-ink-faint" />
			<p class="text-sm text-ink-dim">Select a trophy to read its guide.</p>
		</div>
	{/if}
</aside>
