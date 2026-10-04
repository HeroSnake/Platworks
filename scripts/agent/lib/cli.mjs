/**
 * Shared CLI plumbing for the scripts in scripts/agent/.
 *
 * A thrown error in a bare Node script prints a stack trace, which buries the one
 * line that says what to do next. These scripts fail with instructions instead.
 */

/** Prints `message` and exits non-zero, with no stack trace. */
export function fail(message) {
	console.error(`\n${message}\n`);
	process.exit(1);
}

/**
 * Runs `main` and turns a thrown error into a one-line failure.
 * A non-Error throw is still reported rather than swallowed.
 */
export async function run(main) {
	try {
		await main();
	} catch (e) {
		fail(e instanceof Error ? e.message : String(e));
	}
}