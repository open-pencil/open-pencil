import { describe, expect, it } from 'bun:test'

import { isAliveFromKillError, isProcessAlive } from '#tests/helpers/mcp-discovery-isolation'

describe('mcp-discovery-isolation > isProcessAlive', () => {
  it('returns true for the current (live) process', () => {
    // The stale-dir sweep must never treat the running process as dead.
    expect(isProcessAlive(process.pid)).toBe(true)
  })

  it('treats EPERM (process exists but is unsignalable) as alive', () => {
    // The destructive sweep must NOT delete a dir whose process may exist.
    // This is the defect flagged in scratch/review-01.md.
    const err = new Error('Operation not permitted') as NodeJS.ErrnoException
    err.code = 'EPERM'
    expect(isAliveFromKillError(err)).toBe(true)
  })

  it('treats ESRCH (no such process) as dead', () => {
    const err = new Error('No such process') as NodeJS.ErrnoException
    err.code = 'ESRCH'
    expect(isAliveFromKillError(err)).toBe(false)
  })

  it('treats an error without a code as dead', () => {
    expect(isAliveFromKillError(new Error('unknown'))).toBe(false)
  })

  it('treats a non-Error throw as dead', () => {
    expect(isAliveFromKillError('not an error')).toBe(false)
  })
})
