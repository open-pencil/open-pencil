import { markSessionStarted, startedSessionIds } from '@/app/document/recovery/session/storage'
import { createCanvasId } from '@/app/storage/id'

/** This window's app session; the recovery copies it writes carry this id. */
export const recoverySessionId = createCanvasId()

const SESSION_LOCK_PREFIX = 'open-pencil:recovery-session:'

type SessionLocks = Pick<LockManager, 'query' | 'request'>

function sessionLocks(): SessionLocks | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.locks
}

/** Bumped when the session ends, so a lock granted after that is let go at once. */
let sessionGeneration = 0
let lockRequested = false
let releaseSessionLock: (() => void) | null = null

/**
 * Marks this session running until the window closes, which `endRecoverySession` records. With
 * Web Locks it is marked once its lock is held, so no window ever sees it started but unlocked.
 */
export function startRecoverySession(locks = sessionLocks()): void {
  if (!locks) {
    markSessionStarted(recoverySessionId, true)
    return
  }
  if (lockRequested) return
  lockRequested = true
  const generation = sessionGeneration
  void locks.request(SESSION_LOCK_PREFIX + recoverySessionId, () => {
    if (generation !== sessionGeneration) return undefined
    markSessionStarted(recoverySessionId, true)
    return new Promise<void>((resolve) => {
      releaseSessionLock = resolve
    })
  })
}

/** The window closed or reloaded on purpose, so the copies it leaves were kept, not lost to a crash. */
export function endRecoverySession(): void {
  sessionGeneration++
  markSessionStarted(recoverySessionId, false)
  releaseSessionLock?.()
  releaseSessionLock = null
  lockRequested = false
}

export interface RecoverySessionStates {
  /** Sessions still running in some window, this one included; their copies are theirs. */
  live: ReadonlySet<string>
  /** Sessions that ended without closing their window. */
  crashed: ReadonlySet<string>
}

/**
 * Which sessions are running and which crashed, from the sessions `started` and the ones whose
 * locks are `held`. Without Web Locks (`held` null) a crash cannot be told from another running
 * window, so none counts as crashed and only this window's session as running: Home lists the
 * others' copies without asking at start.
 */
export function sessionStates(
  started: readonly string[],
  held: readonly string[] | null
): RecoverySessionStates {
  if (!held) return { live: new Set([recoverySessionId]), crashed: new Set() }
  const live = new Set([recoverySessionId, ...held])
  return { live, crashed: new Set(started.filter((id) => !live.has(id))) }
}

export async function recoverySessionStates(
  locks = sessionLocks()
): Promise<RecoverySessionStates> {
  if (!locks) return sessionStates(startedSessionIds(), null)
  const before = startedSessionIds()
  const { held = [] } = await locks.query()
  const sessions = held.flatMap(({ name }) =>
    name?.startsWith(SESSION_LOCK_PREFIX) ? [name.slice(SESSION_LOCK_PREFIX.length)] : []
  )
  // Started both before and after the query: one that began or ended meanwhile is not a crash.
  const after = new Set(startedSessionIds())
  return sessionStates(
    before.filter((id) => after.has(id)),
    sessions
  )
}

/** A crash is reported once: its copies stay on Home, but the next start does not ask again. */
export function forgetCrashedSessions(crashed: ReadonlySet<string>): void {
  for (const id of crashed) markSessionStarted(id, false)
}
