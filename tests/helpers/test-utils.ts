import { describe } from 'bun:test'

// Tests that don't run are not useful, but it may be desirable to run only a short subset of tests.
// Set BUN_HEAVY_TESTS to false to skip tests marked as heavy, and set it to true to run them.
// By default, all tests are run.
export const runsHeavyTests = process.env.BUN_HEAVY_TESTS
  ? ['1', 't', 'true'].includes(process.env.BUN_HEAVY_TESTS.trim().toLowerCase())
  : true

export const heavy = describe.if(runsHeavyTests)

// Default per-test timeout in CI is often too short for fixture I/O tests that parse/export
// real .fig files. Use this timeout for tests that are bounded by fixture parsing speed.
export const HEAVY_TEST_TIMEOUT_MS = 30_000
