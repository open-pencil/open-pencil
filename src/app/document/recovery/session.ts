import { useLocalStorage } from '@vueuse/core'

import { createCanvasId } from '@/app/storage/id'

/** This window's app session; the recovery copies it writes carry this id. */
export const recoverySessionId = createCanvasId()

const SESSION_LOCK_PREFIX = 'open-pencil:recovery-session:'

/**
 * Sessions started and not yet ended. Each running one holds its lock too, so a session listed
 * here without its lock ended without closing its window: the app crashed or was killed.
 */
const startedSessions = useLocalStorage<string[]>('open-pencil:recovery-sessions', [])

type SessionLocks = Pick<LockManager, 'query' | 'request'>

function sessionLocks(): SessionLocks | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.locks
}

/** Ends the hold on this session's lock; the lock also goes when the window does, however it goes. */
let releaseSessionLock: (() => void) | null = null

/** Marks this session running until the window closes, which `endRecoverySession` records. */
export function startRecoverySession(locks = sessionLocks()): void {
  if (!startedSessions.value.includes(recoverySessionId))
    startedSessions.value = [...startedSessions.value, recoverySessionId]
  if (releaseSessionLock) return
  void locks?.request(
    SESSION_LOCK_PREFIX + recoverySessionId,
    () =>
      new Promise<void>((resolve) => {
        releaseSessionLock = resolve
      })
  )
}

/** The window closed or reloaded on purpose, so the copies it leaves were kept, not lost to a crash. */
export function endRecoverySession(): void {
  startedSessions.value = startedSessions.value.filter((id) => id !== recoverySessionId)
  releaseSessionLock?.()
  releaseSessionLock = null
}

export interface RecoverySessionStates {
  /** Sessions still running in some window, this one included; their copies are theirs. */
  live: ReadonlySet<string>
  /** Sessions that ended without closing their window. */
  crashed: ReadonlySet<string>
}

/**
 * Which sessions are running and which crashed, from the sessions `started` and the ones whose
 * locks are `held`. Without Web Locks (`held` null) no other window can be told apart from a
 * crashed one, so every started session counts as running and none as crashed.
 */
export function sessionStates(
  started: readonly string[],
  held: readonly string[] | null
): RecoverySessionStates {
  if (!held) return { live: new Set([recoverySessionId, ...started]), crashed: new Set() }
  const live = new Set([recoverySessionId, ...held])
  return { live, crashed: new Set(started.filter((id) => !live.has(id))) }
}

export async function recoverySessionStates(
  locks = sessionLocks()
): Promise<RecoverySessionStates> {
  if (!locks) return sessionStates(startedSessions.value, null)
  const { held = [] } = await locks.query()
  const sessions = held.flatMap(({ name }) =>
    name?.startsWith(SESSION_LOCK_PREFIX) ? [name.slice(SESSION_LOCK_PREFIX.length)] : []
  )
  return sessionStates(startedSessions.value, sessions)
}

/** A crash is reported once: its copies stay on Home, but the next start does not ask again. */
export function forgetCrashedSessions(crashed: ReadonlySet<string>): void {
  startedSessions.value = startedSessions.value.filter((id) => !crashed.has(id))
}
