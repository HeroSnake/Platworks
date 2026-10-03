import vercel from '@sveltejs/adapter-vercel';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// SvelteKit 3 no longer reads `svelte.config.js` — the file's mere presence is a
// hard error. Options now go straight into the plugin: SvelteKit claims its own
// keys (adapter, alias, paths, ...) and forwards everything else to
// vite-plugin-svelte, which is where `compilerOptions` is handled.
//
// The adapter is pinned rather than left to `adapter-auto`: the target is known
// (Vercel), and a pinned adapter is faster to install, deterministic, and
// configurable. `adapter-auto` would otherwise resolve it from `process.env.VERCEL`
// and `npm install` the adapter during the build, which mutates package.json mid-build.
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: vercel(),
			compilerOptions: {
				runes: true
			}
		})
	]
});
