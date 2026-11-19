import { createOccurrenceInterpreter } from '#fig/instance-overrides/interpret'
import type { InstanceOccurrence } from '#fig/instance-overrides/occurrence/types'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

/**
 * Records for component loop cases, as pasted into Figma, and a reader that shows what a read
 * expands and reports.
 */
export const guid = (localID: number): GUID => ({ sessionID: 1, localID })
export const id = (localID: number) => `1:${localID}`

export const DOCUMENT = 0
export const PAGE = 1
export const OTHER_PAGE = 2
export const INNER = 10
export const OUTER = 20
export const NESTED = 21
export const OUTER_INSTANCE = 30
export const ICON = 40

export function record(
  localID: number,
  type: string,
  parent: number | undefined,
  position: string,
  fields: Partial<NodeChange> = {}
): NodeChange {
  return {
    guid: guid(localID),
    type,
    phase: 'CREATED',
    name: `${type} ${localID}`,
    ...(parent === undefined ? {} : { parentIndex: { guid: guid(parent), position } }),
    ...fields
  } as NodeChange
}

export const instance = (
  localID: number,
  parent: number,
  position: string,
  component: number,
  fields: Partial<NodeChange> = {}
) =>
  record(localID, 'INSTANCE', parent, position, {
    symbolData: { symbolID: guid(component), symbolOverrides: [] },
    ...fields
  } as Partial<NodeChange>)

/** Inner, then Outer holding an instance of Inner, then an instance of Outer, on one page. */
export function components(
  fields: { nested?: Partial<NodeChange>; outer?: Partial<NodeChange> } = {}
) {
  return [
    record(DOCUMENT, 'DOCUMENT', undefined, ''),
    record(PAGE, 'CANVAS', DOCUMENT, '!'),
    record(INNER, 'SYMBOL', PAGE, '!'),
    record(OUTER, 'SYMBOL', PAGE, '"', fields.outer),
    instance(NESTED, OUTER, '!', INNER, fields.nested)
  ]
}

/** An occurrence as the layers it shows: each layer's source and the component it expands. */
export interface Shown {
  id: string
  main?: string
  children: Shown[]
}

export function shown(occurrence: InstanceOccurrence): Shown {
  return {
    id: occurrence.sourceId,
    ...(occurrence.mainComponentId ? { main: occurrence.mainComponentId } : {}),
    children: occurrence.children.map(shown)
  }
}

export function read(changes: NodeChange[]) {
  const leftOut: string[] = []
  const missing: string[] = []
  const interpreter = createOccurrenceInterpreter(changes)
  // As a file session reads: a swap whose layer is gone is reported, not fatal.
  const options = {
    onCyclicComponent: ({ instanceId }: { instanceId: string }) => leftOut.push(instanceId),
    onUnresolvedAssignment: () => undefined,
    onMissingComponent: ({ ownerId, componentId }: { ownerId: string; componentId: string }) =>
      missing.push(`${ownerId} -> ${componentId}`)
  }
  return {
    component: (localID: number) => shown(interpreter.component(id(localID), options)),
    instance: (localID: number) => shown(interpreter.instance(id(localID), options)),
    leftOut: () => [...new Set(leftOut)],
    missing: () => [...new Set(missing)]
  }
}

export const swapAt = (path: number[], to: number) => ({
  guidPath: { guids: path.map(guid) },
  overriddenSymbolID: guid(to)
})
