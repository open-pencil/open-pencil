import { resolve } from 'node:path'

/** The CLI entry point, for tests that run it as a subprocess. */
export const CLI_ENTRY = Bun.resolveSync('#cli/index.ts', import.meta.dir)

/** Fixtures shared across the repository; a module import would escape the package root. */
export const FIXTURES = resolve(import.meta.dir, '../../../../tests/fixtures')
