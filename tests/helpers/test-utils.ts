import process from 'node:process'

// Tests that don't run are not useful, but it may be desirable to run only a short subset of tests.
// Set BUN_HEAVY_TESTS to false to skip tests marked as heavy, and set it to true to run them.
// By default, all tests are run.
export const runsHeavyTests = process.env.BUN_HEAVY_TESTS
  ? ['1', 't', 'true'].includes(process.env.BUN_HEAVY_TESTS.trim().toLowerCase())
  : true

// `bun:test` uses the `bun:` protocol which Node.js (Playwright) cannot resolve.
// Guard the import so this helper is safe to load under both runtimes.
// No E2E test imports `heavy` — the no-op fallback is purely defensive.
const isBun = typeof Bun !== 'undefined'

const bunDescribe = isBun ? (await import('bun:test')).describe : undefined

export const heavy: (name: string, fn: () => void) => void =
  bunDescribe?.if(runsHeavyTests) ?? (() => { /* no-op outside Bun runtime */ })

// Default per-test timeout in CI is often too short for fixture I/O tests that parse/export
// real .fig files. Use this timeout for tests that are bounded by fixture parsing speed.
export const HEAVY_TEST_TIMEOUT_MS = 30_000
