import type { GUID } from '@lawha/kiwi/fig'

export function guid(localID: number, sessionID = 1): GUID {
  return { sessionID, localID }
}
