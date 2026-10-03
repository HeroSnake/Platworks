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
		EyeOff,
		Trophy
	} from '@lucide/svelte';
	import type { Achievement } from '#lib/types/game';

	let { achievement, achieved, steamLocked, unlockTime, ontoggle } = $props<{
		achievement: Achievement;
		achieved: boolean;
		steamLocked: boolean;
		unlockTime: Date | null;
		ontoggle: () => void;
	}>();

	let expanded = $state(false);
	let justToggled = $state(false);
	// Guide markup is only built the first time a row is opened. A 100-achievement
	// game otherwise creates every step/warning/note node up front, which is what
	// made selection and interaction sluggish. Stays mounted after first open so
	// the collapse animation still has content to reveal.
	let rendered = $state(false);

	function toggleExpand() {
		expanded = !expanded;
		if (expanded) rendered = true;
	}

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

		// Only `missable` earns an alarm colour; the rest are neutral so a row carrying
		// several tags doesn't turn into a wall of colour.
		const typeStyles: Record<string, string> = {
			missable: 'bg-red-900/40 text-red-300',
			multiplayer: 'bg-steam-light text-gray-300',
			cumulative: 'bg-steam-light text-gray-300',
			secret: 'bg-steam-light text-gray-300'
		};
</script>

<div class="achievement-item rounded-xl border {achieved ? 'border-steam-green/30 bg-steam-green/20' : 'border-transparent bg-steam-blue'}">
	<div class="flex w-full items-center gap-2 p-2 sm:gap-3 sm:p-3">
		<!-- The trophy doubles as the check toggle. Steam's icons are natively 64x64,
		     so this renders 1:1 with no upscaling, and folding the check onto the art
		     buys back the ~40px of rail a separate checkbox column would cost — which
		     is what keeps the name readable down to a 320px viewport. -->
		<button
			class="relative shrink-0 {steamLocked ? 'cursor-default' : 'cursor-pointer'}"
			onclick={handleToggle}
			aria-label={steamLocked
				? `${achievement.name} — unlocked on Steam`
				: achieved
					? `Mark ${achievement.name} as not done`
					: `Mark ${achievement.name} as done`}
			aria-pressed={achieved}
			title={steamLocked ? 'Unlocked on Steam' : achieved ? 'Mark as not done' : 'Mark as done'}
		>
			{#if achievement.iconUrl}
				<!-- Steam publishes only the unlocked (coloured) icon; the locked look is a
				     CSS grayscale of this same file, so there is no second URL to fetch.
				     alt is empty on purpose — the name is rendered next to it. -->
				<img
					src={achievement.iconUrl}
					alt=""
					width="64"
					height="64"
					loading="lazy"
					decoding="async"
					class="h-16 w-16 rounded-lg object-cover transition-[filter,opacity] duration-200 {achieved
						? 'opacity-100 ring-2 ring-steam-green/50'
						: 'opacity-55 grayscale ring-1 ring-white/10'}"
				/>
			{:else}
				<span class="flex h-16 w-16 items-center justify-center rounded-lg bg-steam-light ring-1 ring-white/10">
					<Trophy class="h-7 w-7 text-gray-500" />
				</span>
			{/if}

			<span
				class="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-steam-dark ring-2 ring-steam-dark {justToggled
					? 'check-pop'
					: ''}"
			>
				{#if achieved}
					<CheckCircle class="h-5 w-5 text-green-400" />
				{:else}
					<Circle class="h-5 w-5 text-gray-500" />
				{/if}
			</span>
		</button>

		<button
			class="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3"
			onclick={toggleExpand}
			aria-expanded={expanded}
		>
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-x-1.5 gap-y-1 sm:gap-x-2">
					<span class="text-base font-semibold leading-tight {achieved ? 'text-green-200' : ''}">
						{achievement.name}
					</span>

					{#each achievement.types as tag (tag)}
											{@const Icon = typeIcons[tag]}
						{#if Icon}
												<span class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-tight sm:text-xs {typeStyles[tag] ?? 'bg-steam-light text-gray-300'}">
								<Icon class="h-3 w-3" />
													{tag}
							</span>
						{/if}
										{/each}

					<span class="text-[11px] sm:text-xs {difficultyColors[achievement.difficulty]}">
						{achievement.difficulty}
					</span>
				</div>

				<p class="mt-1 line-clamp-2 text-[13px] leading-snug text-gray-400 sm:line-clamp-none sm:text-sm">{achievement.description}</p>
			</div>

			<ChevronDown class="h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 {expanded ? 'rotate-180' : ''}" />
		</button>
	</div>

	<!-- CSS-animated expand/collapse — no DOM add/remove while animating -->
	<div class="expand-panel" data-open={expanded}>
		<div>
			{#if rendered}
			<div class="border-t border-white/5 px-2 pb-2 pt-3 sm:px-3 sm:pb-3">
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
								class="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300 active:bg-red-900/50 sm:min-h-0 sm:px-2.5 sm:py-1 sm:hover:bg-red-900/50"
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
								class="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-steam-light/50 px-3 py-2 text-xs text-gray-300 active:bg-steam-light sm:min-h-0 sm:px-2.5 sm:py-1 sm:hover:bg-steam-light"
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
			{/if}
		</div>
	</div>
</div>
