import { expect } from 'bun:test'

import type { InstancePathDiagnostic } from '#fig/instance-overrides/interpret'
import { InstancePathError } from '#fig/instance-overrides/occurrence-path'

/**
 * Assert why a path failed to resolve rather than how the message reads. A count of
 * candidates is the contract; the sentence around it is not.
 */
export function expectPathError(
  run: () => unknown,
  reason: InstancePathDiagnostic['reason']
): InstancePathDiagnostic {
  try {
    run()
  } catch (error) {
    if (!(error instanceof InstancePathError)) throw error
    expect(error.diagnostic.reason).toBe(reason)
    return error.diagnostic
  }
  throw new Error(`Expected an InstancePathError with reason ${reason}`)
}
