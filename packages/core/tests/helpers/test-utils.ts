import { describe } from 'bun:test'

// Heavy tests parse the large fixtures, gigabytes each, and run only when BUN_HEAVY_TESTS is
// true, which the unit test runner sets while giving each heavy file its own process. A bare
// `bun test` over a directory skips them, so it cannot hold several such graphs in one process.
export const runsHeavyTests = ['1', 't', 'true'].includes(
  (process.env.BUN_HEAVY_TESTS ?? '').trim().toLowerCase()
)

export const heavy = describe.if(runsHeavyTests)

// Default per-test timeout in CI is often too short for fixture I/O tests that parse/export
// real .fig files. Use this timeout for tests that are bounded by fixture parsing speed.
export const HEAVY_TEST_TIMEOUT_MS = 30_000
