import type { GUID } from './types'

/**
 * Kiwi's all-ones GUID names no node: a cleared style reference, a slot's own content, or a
 * layer without an override key.
 */
export const UNSET_GUID: Readonly<GUID> = { sessionID: 0xffffffff, localID: 0xffffffff }

export function isUnsetGuid(guid: GUID): boolean {
  return guid.sessionID === UNSET_GUID.sessionID && guid.localID === UNSET_GUID.localID
}

export function guidToString(guid: GUID): string {
  return `${guid.sessionID}:${guid.localID}`
}

export function stringToGuid(str: string): GUID {
  const match = str.match(/^(?:VariableID:|VariableCollectionId:)?(\d+):(\d+)$/)
  if (match) {
    return { sessionID: Number.parseInt(match[1], 10), localID: Number.parseInt(match[2], 10) }
  }
  const [session, local] = str.split(':')
  return { sessionID: Number.parseInt(session, 10), localID: Number.parseInt(local, 10) }
}
