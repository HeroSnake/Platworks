<script lang="ts">
	import {
		CircleCheckBig,
		Circle,
		TriangleAlert,
		Video,
		ExternalLink,
		MessageCircle,
		ChevronDown,
		Users,
		Repeat,
		EyeOff,
		Trophy
	} from '@lucide/svelte';
	import DifficultyPips from '#lib/components/difficulty_pips.svelte';
	import { tick } from 'svelte';
	import type { Achievement } from '#lib/types/game';

	let {
		achievement,
		achieved,
		steamLocked,
		unlockTime,
		exiting,
		ontoggle,
		onvanished
	} = $props<{
		achievement: Achievement;
		achieved: boolean;
		steamLocked: boolean;
		unlockTime: Date | null;
		/**
		 * The active filter no longer matches this row — a toggle just pushed it out.
		 * The page keeps it in the list until `onvanished` fires so the animation can
		 * play before the keyed `{#each}` destroys the node.
		 */
		exiting: boolean;
		ontoggle: () => void;
		/** The exit animation has finished; the page may drop the row for good. */
		onvanished: () => void;
	}>();

	let expanded = $state(false);
	let justToggled = $state(false);

	/**
	 * Tiers 3 and 4 — which motion the row is playing, if any.
	 *
	 * The class has to be cleared and re-set to replay on the same row, and Svelte
	 * batches state within a tick, so setting it straight to the same value never
	 * reaches the DOM and the second tap on one trophy silently does nothing.
	 * `playMotion` clears, awaits a tick, then sets — which is the whole reason
	 * `tick` is imported.
	 */
	let motion: 'celebrate' | 'relock' | 'exit' | null = $state(null);
	let motionClass = $derived(
		motion === 'celebrate'
			? 'pw-celebrate'
			: motion === 'relock'
				? 'pw-relock'
				: motion === 'exit'
					? 'pw-exit'
					: ''
	);
	let motionTimer: ReturnType<typeof setTimeout> | undefined;

	// 20ms longer than each CSS duration in `app.css`, so the class outlives the
	// animation rather than being stripped from under it.
	const MOTION_MS = { celebrate: 900, relock: 420, exit: 280 };

	async function playMotion(next: 'celebrate' | 'relock') {
		motion = null;
		await tick();
		motion = next;
		clearTimeout(motionTimer);
		motionTimer = setTimeout(advance, MOTION_MS[next] + 20);
	}

	/**
	 * Hands over to the exit when this toggle pushed the row out of the filtered
	 * list, and otherwise just ends.
	 *
	 * `exiting` cannot be read at toggle time: the page sets it as a consequence of
	 * `ontoggle()`, in the same flush that starts this motion. Reading it here, one
	 * animation later, is what keeps the two in step without a second flag.
	 */
	function advance() {
		if (!exiting) {
			motion = null;
			return;
		}
		motion = 'exit';
		motionTimer = setTimeout(() => {
			motion = null;
			onvanished();
		}, MOTION_MS.exit + 20);
	}

		/**
		 * Cancels an exit the page has given up on.
		 *
		 * `.pw-exit` sets `pointer-events: none`, so a click cannot normally land on a row
		 * that is already collapsing — but the page can also stop holding the row from
		 * under it (a filter or sort change). Without this the card would sit at zero
		 * height and zero opacity, still listed, until the exit timer happened to fire.
		 */
		$effect(() => {
			if (exiting || motion !== 'exit') return;
			motion = null;
			clearTimeout(motionTimer);
		});
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
		// A Steam-locked trophy is the player's own state, not something this app
		// can change, so there is no transition to celebrate and nothing to write.
		if (steamLocked) return;

		// Read the direction BEFORE `ontoggle()` — the parent flips `achieved` as a
		// consequence of it, so afterwards the original direction is gone.
		const wasAchieved = achieved;
		ontoggle();

		justToggled = true;
		setTimeout(() => justToggled = false, 200);

		playMotion(wasAchieved ? 'relock' : 'celebrate');
	}

	const difficultyColors: Record<string, string> = {
		easy: 'text-green-400',
		medium: 'text-yellow-400',
		hard: 'text-orange-400',
		'very-hard': 'text-red-400'
	};

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

<!--
	The card is always opaque `bg-steam-blue`. The "achieved" tint is a separate
	layer *inside* it rather than a translucent fill of its own: `bg-steam-green/10`
	straight on the row lets the page background pattern show straight through the
	trophy, which is unreadable. Compositing the tint over an opaque base keeps the
	tint and keeps the text legible.

		The card is a one-row GRID whose only in-flow child is `.pw-vanish-clip`. That
		is what lets `.pw-exit` close the row with the same `grid-template-rows: 1fr ->
		0fr` trick `.expand-panel` uses, instead of guessing a `max-height` that would
		be wrong at every breakpoint and for every expanded guide. The tint above is
		`absolute`, so it is out of flow and never becomes a grid item.
	-->
	<div
		class="achievement-item relative grid grid-rows-[1fr] rounded-xl border bg-steam-blue {achieved
				? 'border-steam-green/30'
				: 'border-line'} {motionClass}"
	>
		{#if achieved}
			<div class="pointer-events-none absolute inset-0 rounded-xl bg-steam-green/10"></div>
		{/if}
		<div class="pw-vanish-clip">
	<div class="relative flex w-full items-center gap-2 p-2 sm:gap-3 sm:p-3">
		<!-- The trophy doubles as the check toggle. Steam's icons are natively 64x64,
		     so this renders 1:1 with no upscaling, and folding the check onto the art
		     buys back the ~40px of rail a separate checkbox column would cost — which
		     is what keeps the name readable down to a 320px viewport.

		     `self-stretch` fills the row's content box, and the `-ml-*` / `pl-*` pair
		     bleeds the button horizontally into the row's left padding, so the strip
		     starts at the card's inner border. The row's *vertical* padding is covered
		     by the `before:` overlay instead: a negative vertical margin here would
		     shrink the flex line's cross size and collapse the card back to ~67px.

		     `z-10` keeps this rail above the expand button's stretched `::after`, so the
		     left strip toggles and everything else in the header row expands.

		     The `before:` overlay is a real box, so it takes the click itself and it
		     bubbles to this button. It is bounded by the row — it bridges the padding,
		     it never reaches into the expanded panel — so it is safe at every width.

		     The image is centred inside the button, and the check badge is anchored to
		     the image rather than to the button, or it would drift to the card's
		     bottom-right as the row grows. -->
		<button
			class="pw-press relative z-10 -ml-2 flex shrink-0 self-stretch items-center pl-2 before:absolute before:-inset-y-2 before:left-0 before:right-0 before:content-[''] sm:-ml-3 sm:pl-3 sm:before:-inset-y-3 {steamLocked
		     				? 'is-locked'
		     				: ''}"
			onclick={handleToggle}
			aria-label={steamLocked
				? `${achievement.name} — unlocked on Steam`
				: achieved
					? `Mark ${achievement.name} as not done`
					: `Mark ${achievement.name} as done`}
			aria-pressed={achieved}
			title={steamLocked ? 'Unlocked on Steam' : achieved ? 'Mark as not done' : 'Mark as done'}
		>
			<span class="relative block h-16 w-16 shrink-0">
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
					<Trophy class="h-7 w-7 text-ink-faint" />
				</span>
				{/if}

				<span
					class="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-steam-dark ring-2 ring-steam-dark {justToggled
						? 'check-pop'
						: ''}"
				>
					{#if achieved}
						<CircleCheckBig class="h-5 w-5 text-steam-green" />
					{:else}
						<Circle class="h-5 w-5 text-ink-faint" />
					{/if}
				</span>
			</span>
		</button>

		<!--
		     `after:absolute after:inset-0` is what makes the *whole* header row — card
		     padding included — the expand target. `inset-0` resolves against the row
		     (`relative`), not against this button, so the card's padding stops being a
		     dead zone. It stops at the row, so the open guide keeps its own links.

		     The toggle button carries `z-10` to win over this overlay in the left rail.

				     FOUR ZONES, NOT ONE WRAPPED LINE. Name, description, difficulty and tags
				     used to share a single flex-wrap row, so a long trophy name pushed the tags
				     onto line two and the tags and the difficulty became rivals for the same
				     wrap point — the reading order changed depending on the name's length.
				     Each now owns its own block, and the difficulty/tags rail sits under a
				     hairline so it cannot be mistaken for more description.
				-->
				<button
					class="pw-press after:absolute after:inset-0 flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left sm:gap-3"
					onclick={toggleExpand}
					aria-expanded={expanded}
				>
					<div class="min-w-0 flex-1">
						<!-- ZONE 1 — the name, alone on its line. -->
						<div class="text-sm font-semibold leading-tight {achieved ? 'text-steam-green' : 'text-ink'}">
							{achievement.name}
						</div>

						<!--
							ZONE 2 — the description.

							Clamped to two lines at EVERY breakpoint. It used to be
							`line-clamp-2 sm:line-clamp-none`, so a phone showed two lines and a
							laptop showed all of them: the same trophy occupied a third of the
							card height on one screen and a full screen on another, which is what
							made a scrolled list feel like it was shuffling. Two lines everywhere
							gives the list a repeating rhythm; the full text stays one tap away in
							the expanded guide, which is where a 190-character blurb belongs.
						-->
						<p class="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-dim">
							{achievement.description}
						</p>

						<!--
							ZONE 3 + 4 — difficulty and tags, on one rail below a hairline.

							`min-h-5` keeps the rail a fixed height whether or not a trophy
							carries tags: an untagged trophy (`types: []`) renders no badges, and
							without the reservation the rail would collapse and the card would
							jump as the list scrolls past it.
						-->
						<div class="mt-1.5 flex min-h-5 items-center gap-2 border-t border-line pt-1.5">
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
					</div>

					<ChevronDown class="h-5 w-5 shrink-0 text-ink-faint transition-transform duration-200 {expanded ? 'rotate-180' : ''}" />
				</button>
	</div>

	<!-- CSS-animated expand/collapse — no DOM add/remove while animating -->
	<div class="expand-panel" data-open={expanded}>
		<div>
			{#if rendered}
			<!--
				`pl-[4.25rem]` indents the guide to the text column (icon + gap), so the
				steps read as belonging to the title rather than floating under the
				artwork. It collapses to the row padding on phones, where the indent
				would cost more width than it buys.
			-->
			<div class="border-t border-line px-3 pb-3 pt-3 sm:pl-[4.25rem]">
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
								class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-steam-light px-3 text-xs font-medium text-ink hover:bg-steam-light/80 sm:min-h-0 sm:px-2.5 sm:py-1"
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
								class="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-steam-light px-3 text-xs font-medium text-ink hover:bg-steam-light/80 sm:min-h-0 sm:px-2.5 sm:py-1"
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
			</div>
			{/if}
		</div>
	</div>
					</div>
				</div>
