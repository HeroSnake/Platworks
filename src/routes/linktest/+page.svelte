<script lang="ts">
	import AchievementRow from '#lib/components/achievement_row.svelte';
	import type { Achievement } from '#lib/types/game';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Real enriched data, so this exercises the actual link combinations a
	// completionist will hit. The lookup itself lives in +page.server.ts because
	// `#lib/server/*` cannot be imported into browser code.
	const byId = $derived(new Map(data.game.achievements.map((a) => [a.id, a])));

	const cases: { label: string; a: Achievement; gameMap?: string }[] = $derived([
		{
			label: 'source + game map (A Peculiar Encounter)',
			a: byId.get('A_PECULIAR_ENCOUNTER')!,
			gameMap: data.game.mapUrl
		},
		{ label: 'source only, no game map', a: byId.get('PAINTRESS')! },
		{
			label: 'game map fallback',
			a: { ...byId.get('LUMIERE')!, guide: { steps: ['Only steps, no links.'] } },
			gameMap: data.game.mapUrl
		},
		{
			label: 'own deep-link map overrides game map',
			a: {
				...byId.get('OLD_LUMIERE')!,
				guide: {
					...byId.get('OLD_LUMIERE')!.guide,
					mapUrl: 'https://mapgenie.io/clair-obscur-expedition-33#old-lumiere'
				}
			},
			gameMap: data.game.mapUrl
		}
	]);
</script>

<div class="mx-auto max-w-2xl space-y-2 bg-steam-dark p-2">
	{#each cases as c (c.label)}
		<p class="px-1 pt-2 text-[11px] uppercase tracking-wide text-gray-500">{c.label}</p>
		<AchievementRow
			achievement={c.a}
			achieved={false}
			steamLocked={false}
			unlockTime={null}
			ontoggle={() => {}}
		/>
		<!-- Force the panel open: it is CSS-driven, so data-open is enough. -->
		<div class="expand-panel" data-open="true">
			<div>
				<div class="border-t border-white/5 px-2 pb-2 pt-3">
					<ol class="mb-3 space-y-2 text-sm">
						{#each c.a.guide.steps as s, i (i)}<li class="text-gray-300">{i + 1}. {s}</li>{/each}
					</ol>
					{#if c.a.guide.videoUrl || c.a.guide.sourceUrl || c.a.guide.mapUrl || c.gameMap}
						<div class="mb-3 flex flex-wrap gap-2">
							{#if c.a.guide.videoUrl}
								<a href={c.a.guide.videoUrl} class="inline-flex items-center gap-1.5 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-300">Video</a>
							{/if}
							{#if c.a.guide.sourceUrl}
								<a href={c.a.guide.sourceUrl} class="inline-flex items-center gap-1.5 rounded-lg bg-steam-light/50 px-3 py-2 text-xs text-gray-300">Written Guide</a>
							{/if}
							{#if c.a.guide.mapUrl || c.gameMap}
								<a
									href={c.a.guide.mapUrl ?? c.gameMap}
									class="inline-flex items-center gap-1.5 rounded-lg bg-steam-light/50 px-3 py-2 text-xs text-gray-300"
								>
									{c.a.guide.mapUrl ? 'Location Map' : 'Game Map'}
								</a>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/each}
</div>