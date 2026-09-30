<script lang="ts">
	import {
		CheckCircle,
		Circle,
		AlertTriangle,
		Video,
		ExternalLink,
		MessageCircle,
		ChevronDown,
		Users,
		Repeat,
		EyeOff
	} from '@lucide/svelte';
	import type { Achievement } from '$lib/types/game';

	let { achievement, achieved, steamLocked, unlockTime, ontoggle } = $props<{
		achievement: Achievement;
		achieved: boolean;
		steamLocked: boolean;
		unlockTime: Date | null;
		ontoggle: () => void;
	}>();

	let expanded = $state(false);
	let justToggled = $state(false);

	function handleToggle(e: MouseEvent) {
		e.stopPropagation();
		ontoggle();
		justToggled = true;
		setTimeout(() => justToggled = false, 200);
	}

	const difficultyColors: Record<string, string> = {
		easy: 'text-green-400',
		medium: 'text-yellow-400',
		hard: 'text-orange-400',
		'very-hard': 'text-red-400'
	};

	const typeIcons: Record<string, typeof AlertTriangle> = {
		missable: AlertTriangle,
		multiplayer: Users,
		cumulative: Repeat,
		secret: EyeOff
	};
</script>

<div class="achievement-item rounded-xl border {achieved ? 'border-steam-green/30 bg-steam-green/20' : 'border-transparent bg-steam-blue'}">
	<div class="flex w-full items-start gap-3 p-3 sm:items-center sm:gap-4 sm:p-4">
		<button
			class="mt-0.5 shrink-0 sm:mt-0 {steamLocked ? 'cursor-default' : 'cursor-pointer'}"
			onclick={handleToggle}
			title={steamLocked ? 'Unlocked on Steam' : achieved ? 'Mark as not done' : 'Mark as done'}
		>
			<span class={justToggled ? 'check-pop inline-block' : 'inline-block'}>
				{#if achieved}
					<CheckCircle class="h-5 w-5 text-green-400 sm:h-6 sm:w-6" />
				{:else}
					<Circle class="h-5 w-5 text-gray-600 sm:h-6 sm:w-6" />
				{/if}
			</span>
		</button>

		<button
			class="flex min-w-0 flex-1 items-start gap-3 text-left sm:items-center"
			onclick={() => expanded = !expanded}
		>
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
					<span class="text-sm font-semibold sm:text-base {achieved ? 'text-green-200' : ''}">
						{achievement.name}
					</span>

					{#if achievement.type !== 'standard'}
						{@const Icon = typeIcons[achievement.type]}
						{#if Icon}
							<span class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-tight sm:text-xs {achievement.type === 'missable' ? 'bg-red-900/40 text-red-300' : 'bg-steam-light text-gray-300'}">
								<Icon class="h-3 w-3" />
								{achievement.type}
							</span>
						{/if}
					{/if}

					<span class="text-[10px] sm:text-xs {difficultyColors[achievement.difficulty]}">
						{achievement.difficulty}
					</span>
				</div>

				<p class="mt-0.5 line-clamp-2 text-xs text-gray-400 sm:line-clamp-none sm:text-sm">{achievement.description}</p>
			</div>

			<ChevronDown class="mt-0.5 h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 sm:mt-0 {expanded ? 'rotate-180' : ''}" />
		</button>
	</div>

	<!-- CSS-animated expand/collapse — no DOM add/remove -->
	<div class="expand-panel" data-open={expanded}>
		<div>
			<div class="border-t border-white/5 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
				<ol class="mb-3 space-y-2 text-sm">
					{#each achievement.guide.steps as step, i}
						<li class="flex gap-2.5">
							<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-steam-light text-xs text-gray-300">
								{i + 1}
							</span>
							<span class="text-gray-300">{step}</span>
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
								class="inline-flex items-center gap-1.5 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300 active:bg-red-900/50 sm:px-2.5 sm:py-1 sm:hover:bg-red-900/50"
							>
								<Video class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
								Video Guide
							</a>
						{/if}
						{#if achievement.guide.sourceUrl}
							<a
								href={achievement.guide.sourceUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 rounded-lg bg-steam-light/50 px-3 py-2 text-xs text-gray-300 active:bg-steam-light sm:px-2.5 sm:py-1 sm:hover:bg-steam-light"
							>
								<ExternalLink class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
								Written Guide
							</a>
						{/if}
					</div>
				{/if}

				{#if achievement.guide.warnings?.length}
					<div class="mb-3 space-y-1.5">
						{#each achievement.guide.warnings as warning}
							<div class="flex items-start gap-2 rounded-lg bg-yellow-900/20 px-3 py-2.5 text-xs text-yellow-300 sm:text-sm">
								<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
								<span>{warning}</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if achievement.guide.communityNotes?.length}
					<div class="space-y-1.5">
						{#each achievement.guide.communityNotes as note}
							<div class="flex items-start gap-2 text-xs text-gray-400 sm:text-sm">
								<MessageCircle class="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
								<span>{note}</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if unlockTime}
					<p class="mt-3 text-xs text-gray-500">
						Unlocked {unlockTime.toLocaleDateString()}
					</p>
				{/if}
			</div>
		</div>
	</div>
</div>
