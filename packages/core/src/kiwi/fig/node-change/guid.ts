import type { GUID } from '#core/kiwi/fig/codec'

export function guidToString(guid: GUID): string {
  return `${guid.sessionID}:${guid.localID}`
}

export function stringToGuid(str: string): GUID {
  const match = str.match(/^(?:VariableID:|VariableCollectionId:)?(\d+):(\d+)$/)
  if (match)
    return { sessionID: Number.parseInt(match[1], 10), localID: Number.parseInt(match[2], 10) }
  const [session, local] = str.split(':')
  return { sessionID: Number.parseInt(session, 10), localID: Number.parseInt(local, 10) }
}
