<script lang="ts">
	import { Check, Clock, TriangleAlert, Trophy, ChevronDown, SkipForward } from '@lucide/svelte';
	import ProgressBar from '#lib/components/progress_bar.svelte';
	import type { ChecklistGroup, ChecklistStep } from '#lib/types/game';

	/**
	 * The game page's Checklist tab.
	 *
	 * Shape (approved as variant C): one focus card for the next step, a short
	 * "then" queue beside it, and the full list collapsed per act below.
	 *
	 * Two rules this component exists to hold:
	 *
	 * - **A step either has a deadline or it does not.** The deadline line renders
	 *   only when the data has one; the alternative is a muted clock line, never an
	 *   empty block. `deadline` is authored, not inferred.
	 * - **Ticking never moves the card by accident.** The card always shows the
	 *   first *undone* step, computed from the same state that draws the ticks, so
	 *   a marked step cannot stay on screen as if it were pending.
	 */
	let {
		groups,
		done,
		unlocked,
		ontoggle
	}: {
		groups: ChecklistGroup[];
		done: Record<string, boolean>;
		/** Achievement names the player has unlocked, for the chip state. */
		unlocked: Set<string>;
		ontoggle: (id: string, next: boolean) => void;
	} = $props();

	type Flat = ChecklistStep & { group: ChecklistGroup; indexInGroup: number };

	const flat = $derived<Flat[]>(
		groups.flatMap((group) =>
			group.steps.map((step, indexInGroup) => ({ ...step, group, indexInGroup }))
		)
	);

	const doneCount = $derived(flat.filter((s) => done[s.id]).length);
	const total = $derived(flat.length);
	const percent = $derived(total ? Math.round((doneCount / total) * 100) : 0);
	const missableLeft = $derived(flat.filter((s) => s.missable && !done[s.id]).length);

	/** A step the player explicitly skipped to; cleared whenever the data moves on. */
	let pinned = $state<string | null>(null);

	const currentIndex = $derived.by(() => {
		const pinnedIndex = pinned ? flat.findIndex((s) => s.id === pinned) : -1;
		if (pinnedIndex !== -1 && !done[flat[pinnedIndex].id]) return pinnedIndex;
		return flat.findIndex((s) => !done[s.id]);
	});

	const current = $derived(currentIndex === -1 ? null : flat[currentIndex]);

	/** The next three undone steps after the focus card, across group boundaries. */
	const queue = $derived(
		currentIndex === -1
			? []
			: flat.slice(currentIndex + 1).filter((s) => !done[s.id]).slice(0, 3)
	);

	/** Steps still open in an earlier group than the focus card — the audit signal. */
	const behind = $derived.by(() => {
		if (!current) return 0;
		const currentGroupIndex = groups.findIndex((g) => g.id === current.group.id);
		return flat.filter(
			(s) => !done[s.id] && groups.findIndex((g) => g.id === s.group.id) < currentGroupIndex
		).length;
	});

	// Disclosure state. Undecided groups follow the focus: the act you are in is
	// open, the rest are not. A group the player has touched keeps their choice.
	let expanded = $state<Record<string, boolean>>({});
	const isOpen = (groupId: string) => expanded[groupId] ?? groupId === current?.group.id;

	let popping = $state<string | null>(null);
	let popTimer: ReturnType<typeof setTimeout> | undefined;

	function tick(step: Flat) {
		const next = !done[step.id];
		ontoggle(step.id, next);
		pinned = null;
		if (next) {
			popping = step.id;
			clearTimeout(popTimer);
			// 40ms longer than the CSS animation, so a re-tick replays it.
			popTimer = setTimeout(() => (popping = null), 260);
		}
	}

	function skip() {
		const next = flat.slice(currentIndex + 1).find((s) => !done[s.id]);
		pinned = next?.id ?? null;
	}

	function jumpTo(step: Flat) {
		pinned = step.id;
		expanded = { ...expanded, [step.group.id]: true };
	}

	$effect(() => () => clearTimeout(popTimer));
</script>

<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
	<!-- Focus card. Keyed on the step id so a new step slides in instead of
	     swapping text under the eye. -->
	<section
		class="min-w-0 flex-1 rounded-xl border border-line bg-steam-blue p-4 sm:p-5"
		aria-label="Current checklist step"
	>
		{#if current}
			{#key current.id}
				<div class="pw-step-swap">
					<p class="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
						{current.group.label} · step {current.indexInGroup + 1} of {current.group.steps.length}
						<span
							class="rounded-full px-2 py-[1px] text-[9px] tracking-[0.04em] normal-case {current.deadline
								? 'bg-steam-accent/15 text-steam-accent'
								: 'bg-steam-light text-ink-faint'}"
						>
							{current.deadline ? 'Act-bound' : 'Any act'}
						</span>
					</p>

					<h2 class="mt-2 font-display text-lg font-semibold leading-snug text-ink sm:text-xl">
						{current.text}
					</h2>

					{#if current.trophies?.length}
						<div class="mt-2.5 flex flex-wrap gap-1.5">
							{#each current.trophies as name (name)}
								<span
									class="inline-flex items-center gap-1 rounded-full border border-line bg-steam-light px-2 py-0.5 text-[11px] {unlocked.has(name)
										? 'text-steam-green'
										: 'text-ink-dim'}"
								>
									<Trophy class="h-3 w-3 shrink-0" />
									{name}
									{#if unlocked.has(name)}
										<Check class="h-3 w-3 shrink-0" />
									{/if}
								</span>
							{/each}
						</div>
					{/if}

					<!-- The action comes BEFORE the explanation: on a phone this is the
					     control the card exists for, and it was previously the last thing. -->
					<div class="mt-3 flex flex-wrap gap-2">
						<button
							type="button"
							class="h-10 rounded-lg bg-steam-accent px-4 text-sm font-semibold text-accent-ink hover:brightness-110"
							onclick={() => tick(current)}
						>
							Mark done
						</button>
						{#if queue.length}
							<button
								type="button"
								class="flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-ink-dim hover:bg-steam-blue hover:text-ink"
								onclick={skip}
							>
								<SkipForward class="h-3.5 w-3.5" />
								Skip for now
							</button>
						{/if}
					</div>

					{#if current.deadline}
						<p class="mt-3 rounded-lg border border-line border-l-2 border-l-steam-accent bg-steam-dark px-3 py-2 text-[13px] leading-relaxed text-ink-dim">
							<strong class="text-ink">Why now:</strong>
							{current.deadline}
						</p>
					{:else}
						<p class="mt-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-ink-faint">
							<Clock class="mt-[2px] h-3.5 w-3.5 shrink-0" />
							No deadline — nothing about this step expires when the act ends.
						</p>
					{/if}

					<div class="mt-4 border-t border-line pt-3">
						<ProgressBar percent={percent} height={5} />
						<p class="mt-2 text-[11px] text-ink-faint">
							<span class="tabular font-mono">{doneCount}</span> of
							<span class="tabular font-mono">{total}</span> steps{missableLeft
								? ` — ${missableLeft} missable still open`
								: ''}
						</p>
					</div>
				</div>
			{/key}
		{:else}
			<div class="pw-step-swap py-4 text-center">
				<p class="font-display text-lg font-semibold text-steam-green">Checklist complete</p>
				<p class="mt-1 text-sm text-ink-dim">Every step on this list is ticked.</p>
				<div class="mx-auto mt-4 max-w-[240px]">
					<ProgressBar percent={100} height={5} />
				</div>
			</div>
		{/if}
	</section>

	<!-- Queue. A real jump-to, so the list below is not the only way to move. -->
	{#if queue.length}
		<aside class="rounded-xl border border-line bg-steam-blue p-3 lg:w-72 lg:shrink-0" aria-label="Upcoming steps">
			<p class="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">Then</p>
			<ol class="mt-2 flex flex-col gap-1.5">
				{#each queue as step, i (step.id)}
					<li>
						<button
							type="button"
							class="flex min-h-10 w-full items-start gap-2 rounded-lg border border-line bg-steam-light p-2 text-left text-[12.5px] leading-snug text-ink-dim hover:text-ink"
							onclick={() => jumpTo(step)}
						>
							<span class="tabular mt-[3px] font-mono text-[10px] text-ink-faint">{i + 1}</span>
							<span class="min-w-0">{step.text}</span>
						</button>
					</li>
				{/each}
			</ol>
			{#if behind}
				<p class="mt-2 text-[11px] text-ink-faint">
					{behind} open step{behind === 1 ? '' : 's'} in earlier acts
				</p>
			{/if}
		</aside>
	{/if}
</div>

<!-- Full list. One real button per group driving `.expand-panel`, which is the
     app's existing grid-template-rows disclosure — `<details>` cannot animate. -->
<section class="mt-5">
	<h2 class="font-display text-sm font-semibold text-ink">Full checklist</h2>
	<div class="mt-2 flex flex-col gap-2">
		{#each groups as group (group.id)}
			{@const groupDone = group.steps.filter((s) => done[s.id]).length}
			{@const open = isOpen(group.id)}
			<div class="overflow-hidden rounded-lg border border-line bg-steam-blue">
				<button
					type="button"
					class="flex min-h-12 w-full items-center gap-2 border-b border-line px-3 text-left"
					aria-expanded={open}
					aria-controls="pw-group-{group.id}"
					onclick={() => (expanded = { ...expanded, [group.id]: !open })}
				>
					<span class="text-xs font-semibold text-ink">{group.label}</span>
					<span class="hidden min-w-0 truncate text-[11px] text-ink-faint sm:inline">{group.title}</span>
					<span class="tabular ml-auto font-mono text-[11px] text-ink-dim">{groupDone}/{group.steps.length}</span>
					<ChevronDown class="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 {open ? 'rotate-180' : ''}" />
				</button>

				<div
					id="pw-group-{group.id}"
					class="expand-panel"
					data-open={open}
				>
					<div>
						<ul class="flex flex-col gap-1.5 px-2 pb-2">
							{#each group.steps as step, i (step.id)}
								{@const isDone = !!done[step.id]}
								<li
									class="relative flex items-start gap-1 rounded-lg border bg-steam-blue p-2 {isDone
										? 'border-steam-green/30'
										: 'border-line'}"
								>
									<!-- The achieved tint is a layer INSIDE an opaque card, exactly like
									     `achievement_row.svelte` — a translucent fill let the page's
									     background pattern read straight through the row. -->
									{#if isDone}
										<span class="pointer-events-none absolute inset-0 rounded-lg bg-steam-green/10"></span>
									{/if}
									<button
										type="button"
										role="checkbox"
										aria-checked={isDone}
										aria-label="{isDone ? 'Untick' : 'Mark done'}: {step.text}"
										class="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
										onclick={() => tick({ ...step, group, indexInGroup: i })}
									>
										<span
											class="pw-tick grid h-[22px] w-[22px] place-items-center rounded-md border transition-colors {isDone
												? 'border-steam-green bg-steam-green text-steam-dark'
												: 'border-line bg-steam-dark text-transparent'} {popping === step.id ? 'check-pop' : ''}"
										>
											<Check class="h-3.5 w-3.5" strokeWidth={3} />
										</span>
									</button>

									<div class="min-w-0 flex-1 pt-[3px]">
										<div class="flex flex-wrap items-center gap-1.5">
											<span
												class="text-[13.5px] leading-snug {isDone
													? 'text-ink-dim line-through decoration-steam-green/60'
													: 'text-ink'}"
											>
												{step.text}
											</span>
											{#if step.missable}
												<span class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.04em] text-red-300">
													<TriangleAlert class="h-2.5 w-2.5" />
													Missable
												</span>
											{/if}
										</div>

										{#if step.deadline}
											<p class="mt-1 text-[11px] leading-snug text-red-300/90">{step.deadline}</p>
										{/if}

										{#if step.trophies?.length}
											<div class="mt-1.5 flex flex-wrap gap-1">
												{#each step.trophies as name (name)}
													<span
														class="inline-flex items-center gap-1 rounded-full border border-line bg-steam-light px-1.5 py-[1px] text-[10px] {unlocked.has(
															name
														)
															? 'text-steam-green'
															: 'text-ink-faint'}"
													>
														<Trophy class="h-2.5 w-2.5" />
														{name}
													</span>
												{/each}
											</div>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		{/each}
	</div>
</section>
