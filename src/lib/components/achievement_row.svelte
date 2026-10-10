<script lang="ts">
	import { CircleCheckBig, Circle, ChevronDown, Trophy } from '@lucide/svelte';
	import AchievementMeta from '#lib/components/achievement_meta.svelte';
	import AchievementGuide from '#lib/components/achievement_guide.svelte';
	import { tick } from 'svelte';
	import type { Achievement } from '#lib/types/game';

	let {
		achievement,
		achieved,
		steamLocked,
		unlockTime,
		exiting,
		celebration = 0,
		selected = false,
		ontoggle,
		onactivate,
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
		/**
		 * A per-unlock token, bumped by the page whenever Steam sync unlocks this
		 * trophy. Steam's XML flips `achieved` with no finger on the screen, so
		 * without this a synced trophy appeared silently while a tapped one leapt.
		 *
		 * A NUMBER rather than a boolean: the page clears the token once the
		 * animation is over, so a row that remounts later (a filter or sort change)
		 * reads 0 and stays quiet. A boolean would have to stay `true` for that to
		 * work and would replay the celebration on every remount.
		 */
		celebration?: number;
		/**
		 * Desktop master–detail: this is the card whose guide the sticky
		 * `trophy_panel.svelte` is showing, so it must be visibly the active one or
		 * the panel silently describes a card the player cannot identify. Highlighted
		 * at `lg` and up only: below `lg` the panel is hidden and the row expands
		 * inline, so the accent ring there would mark a card for no reason.
		 */
		selected?: boolean;
		ontoggle: () => void;
		/**
		 * The page's desktop card grid uses this to fill its sticky detail panel.
		 * It fires on the same click that toggles the inline expansion, so the panel
		 * and the row can never get out of step. Below `lg` the panel is hidden and
		 * this is inert.
		 */
		onactivate?: () => void;
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
	 * Celebrates an unlock the player did not tap.
	 *
	 * `advance()` is reused rather than re-implemented: a trophy Steam just unlocked
	 * can land in exactly the same trap as a tapped one — under a Locked filter it
	 * leaves the list, and only the handover keeps its collapse visible. The token
	 * comparison is what makes this fire per unlock instead of on every re-render,
	 * and what stops the page clearing it from replaying the animation.
	 */
	let celebratedToken = 0;
	$effect(() => {
		const token = celebration;
		if (!token || token === celebratedToken) return;
		celebratedToken = token;
		// Steam-locked means the trophy is visible but not the player's to change,
		// so it is never a candidate in the first place — same guard as a tap.
		if (steamLocked) return;
		playMotion('celebrate');
	});

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
		// The desktop grid fills its detail panel off the same click.
		onactivate?.();
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

	The layout is the same at every width — trophy icon on the left, text on the
	right — and only the CONTAINER changes: a one-column stack below `lg`, a two-up
	grid of these wide cards from `2xl` (see `.pw-trophy-grid`). The guide is the one
	thing that differs: below `lg` it expands inline, and at `lg` and up it is `hidden`
	here because the page's sticky detail panel is the desktop guide surface, so a
	card never expands and never renders a second copy of the guide links.
-->
<div
	class="achievement-item relative grid grid-rows-[1fr] rounded-xl border bg-steam-blue {achieved
		? 'border-steam-green/30'
		: 'border-line'} {selected
		? 'lg:border-steam-accent lg:ring-2 lg:ring-steam-accent'
		: ''} {motionClass}"
>
	{#if achieved}
		<div class="pointer-events-none absolute inset-0 rounded-xl bg-steam-green/10"></div>
	{/if}
	<div class="pw-vanish-clip">
		<div class="relative flex w-full items-center gap-2 p-2 sm:gap-3 sm:p-3 lg:h-full">
			<!-- The trophy doubles as the check toggle. Steam's icons are natively 64x64,
			     so this renders 1:1 with no upscaling, and folding the check onto the art
			     buys back the ~40px of rail a separate checkbox column would cost — which
			     is what keeps the name readable down to a 320px viewport.

			     `self-stretch` fills the row's content box, and the `-ml-*` / `pl-*` pair
			     bleeds the button horizontally into the row's left padding, so the strip
			     starts at the card's inner border. The row's *vertical* padding is covered
			     by the `before:` overlay instead: a negative vertical margin here would
			     shrink the flex line's cross size and collapse the card back to ~67px.

			     At `lg` the card is a WIDE horizontal card, so this stays the left rail —
			     the icon sits at the start of the wide rectangle and the info fills the
			     rest of it.

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
			     `after:absolute after:inset-0` is what makes the *whole* header — card
			     padding included — the expand target. `inset-0` resolves against the header
			     (`relative`), not against this button, so the card's padding stops being a
			     dead zone. It stops at the header, so the open guide keeps its own links.

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

					<!-- ZONE 3 + 4 — difficulty and tags, on one rail below a hairline.
					     `AchievementMeta` owns the pips and badges (shared with the panel);
					     the hairline belongs to the caller so the card can draw it full-width. -->
					<div class="mt-1.5 border-t border-line pt-1.5">
						<AchievementMeta {achievement} />
					</div>
				</div>

				<!-- Hidden at `lg`: the card does not expand in place there — the click
				     selects into the panel — so a rotating chevron would promise the wrong
				     thing. Below `lg` it is the inline-expansion affordance it always was. -->
				<ChevronDown class="h-5 w-5 shrink-0 text-ink-faint transition-transform duration-200 lg:hidden {expanded ? 'rotate-180' : ''}" />
			</button>
		</div>

		<!-- CSS-animated expand/collapse — no DOM add/remove while animating.
		     Hidden at `lg` by an app.css rule (`.achievement-item .expand-panel`), NOT a
		     Tailwind class: a layered `lg:hidden` loses to the unlayered
		     `.expand-panel { display: grid }`, which let an expanded card grow the whole
		     grid row. At desktop the guide lives in the page's detail panel. -->
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
						<AchievementGuide {achievement} {unlockTime} />
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
