import adapter from '@sveltejs/adapter-auto';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// SvelteKit 3 no longer reads `svelte.config.js` — the file's mere presence is a
// hard error. Options now go straight into the plugin: SvelteKit claims its own
// keys (adapter, alias, paths, ...) and forwards everything else to
// vite-plugin-svelte, which is where `compilerOptions` is handled.
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			compilerOptions: {
				runes: true
			}
		})
	]
});
