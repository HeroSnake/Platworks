<script lang="ts">
	import MobileBar from '#lib/components/mobile_bar.svelte';

	// Drives the real component at both extremes so the complete/incomplete
	// branches can be inspected in the SSR output. Temporary — deleted after.
	const cases = [100, 42];
</script>

<div class="bg-steam-dark">
	{#each cases as p (p)}
		<MobileBar
			percent={p}
			primary={`${p}% done`}
			secondary={`case ${p}`}
			onsync={() => {}}
			onsearch={() => {}}
		/>
	{/each}

	<!-- Mirrors the inline game-page progress bar at both states. -->
	{#each cases as p (p)}
		<div class="mt-5">
			<span class="tabular-nums {p === 100 ? 'text-green-400' : 'text-gray-400'}">{p}%</span>
			<div class="h-3 overflow-hidden rounded-full bg-steam-light">
				<div
					class="h-full w-full origin-left rounded-full transition-transform duration-500 ease-out {p === 100
						? 'bg-gradient-to-r from-green-400 to-green-300'
						: 'bg-gradient-to-r from-steam-accent to-blue-400'}"
					style:transform="scaleX({p / 100})"
				></div>
			</div>
		</div>
	{/each}
</div>