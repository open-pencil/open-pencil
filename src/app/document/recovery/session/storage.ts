/**
 * One local storage key per started recovery session, so windows starting together never
 * overwrite each other's entry. A running session also holds its lock, so a started session
 * without its lock ended without closing its window: the app crashed or was killed.
 */
const STARTED_SESSION_PREFIX = 'open-pencil:recovery-started:'

type SessionRegistry = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

let override: SessionRegistry | null | undefined

/** Local storage, absent or throwing in private windows and with site data blocked. */
function registry(): SessionRegistry | null {
  if (override !== undefined) return override
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function markSessionStarted(id: string, started: boolean): void {
  try {
    if (started) registry()?.setItem(STARTED_SESSION_PREFIX + id, '1')
    else registry()?.removeItem(STARTED_SESSION_PREFIX + id)
  } catch (error) {
    console.warn('[Recovery] Could not record the session:', error)
  }
}

export function startedSessionIds(): string[] {
  const store = registry()
  if (!store) return []
  const ids: string[] = []
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index)
    if (key?.startsWith(STARTED_SESSION_PREFIX)) ids.push(key.slice(STARTED_SESSION_PREFIX.length))
  }
  return ids
}

/** Tests keep sessions in `store`; `undefined` goes back to local storage. */
export function setSessionRegistryForTests(store: SessionRegistry | null | undefined): void {
  override = store
}
