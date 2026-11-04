/** The CLI entry point, for tests that run it as a subprocess. */
export const CLI_ENTRY = Bun.resolveSync('#cli/index.ts', import.meta.dir)
