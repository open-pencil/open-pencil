import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

const VARIABLE_TYPES = new Set(['VARIABLE', 'VARIABLE_SET'])

/** A GUID as `session:local`, or undefined when there is none. */
export function guidKey(guid: GUID | undefined): string | undefined {
  return guid ? guidToString(guid) : undefined
}

/**
 * A record as merging sees it: its identity, place and type, with its contents either the bytes
 * the archive holds or a record to encode.
 */
export interface RecordEntry<Value> {
  id: string | undefined
  parent: string | undefined
  type: string | undefined
  parentIndex: NodeChange['parentIndex']
  value: Value
}

export function entryOf(record: NodeChange): RecordEntry<NodeChange> {
  return {
    id: guidKey(record.guid),
    parent: guidKey(record.parentIndex?.guid),
    type: record.type,
    parentIndex: record.parentIndex,
    value: record
  }
}

export const isVariable = (entry: { type: string | undefined }) =>
  !!entry.type && VARIABLE_TYPES.has(entry.type)
