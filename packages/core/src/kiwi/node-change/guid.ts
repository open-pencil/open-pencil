import type { GUID } from '#core/kiwi/binary/codec'

export function guidToString(guid: GUID): string {
  return `${guid.sessionID}:${guid.localID}`
}

export function stringToGuid(str: string): GUID {
  const match = str.match(/^(?:VariableID:|VariableCollectionId:)?(\d+):(\d+)$/)
  if (match) return { sessionID: parseInt(match[1], 10), localID: parseInt(match[2], 10) }
  const [session, local] = str.split(':')
  return { sessionID: parseInt(session, 10), localID: parseInt(local, 10) }
}
