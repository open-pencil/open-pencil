import { describe } from 'bun:test'

// Tests that don't run are not useful, but it may be desirable to run only a short subset of tests.
// Set BUN_HEAVY_TESTS to false to skip tests marked as heavy, and set it to true to run them.
// By default, all tests are run.
export const heavy = describe.if(
  process.env.BUN_HEAVY_TESTS
    ? ['1', 't', 'true'].includes(process.env.BUN_HEAVY_TESTS.trim().toLowerCase())
    : true
)
