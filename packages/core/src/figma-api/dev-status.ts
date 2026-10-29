import * as v from 'valibot'

import {
  effectiveStatus,
  FIGMA_DEV_STATUSES,
  FIGMA_STATUS_STATE_IDS,
  figmaDevStatusOf,
  statusPlacement,
  STATUS_NODE_TYPES,
  type FigmaDevStatus
} from '@open-pencil/scene-graph/statuses'

import type { NodeProxyInternals, ProxyThis } from './accessor-utils'
import { graph, raw, updateNode } from './accessor-utils'

/** Figma's `DevStatus`; a description is not kept, as comments hold what people say about it. */
export type FigmaDevStatusValue = { type: FigmaDevStatus; description?: string } | null

const devStatusInputSchema = v.nullable(
  v.object({ type: v.picklist(FIGMA_DEV_STATUSES), description: v.optional(v.string()) })
)

/** Figma's errors for a layer that cannot show a status where it is (Figma desktop 126). */
const PLACEMENT_ERRORS = {
  parent:
    'in set_devStatus: Cannot set devStatus on a node that is not directly under a page or section',
  ancestor:
    'in set_devStatus: Cannot set devStatus on a node inside another node with non-null devStatus'
} as const

/**
 * `devStatus` on the layers Figma gives it to. It reads the status the layer shows, as Figma's
 * Ready for dev or Completed, and null for a hidden status or one Figma has no counterpart for;
 * a description given with it is not kept.
 * Other layers have no `devStatus`, and setting it does nothing, as in Figma.
 */
export function installDevStatusAccessors(prototype: object, internals: NodeProxyInternals): void {
  Object.defineProperties(prototype, {
    devStatus: {
      get(this: ProxyThis): FigmaDevStatusValue | undefined {
        const node = raw(this, internals)
        if (!STATUS_NODE_TYPES.has(node.type)) return undefined
        const status = effectiveStatus(graph(this, internals), node)
        const type = status ? figmaDevStatusOf(status) : null
        return type ? { type } : null
      },
      set(this: ProxyThis, value: unknown) {
        const node = raw(this, internals)
        if (!STATUS_NODE_TYPES.has(node.type)) return
        const parsed = v.safeParse(devStatusInputSchema, value)
        if (!parsed.success) throw new Error('in set_devStatus: Expected a DevStatus or null')
        if (parsed.output === null) {
          updateNode(this, internals, { status: null })
          return
        }
        const placement = statusPlacement(graph(this, internals), node)
        if (placement === 'parent' || placement === 'ancestor') {
          throw new Error(PLACEMENT_ERRORS[placement])
        }
        const status = FIGMA_STATUS_STATE_IDS[parsed.output.type]
        updateNode(this, internals, { status })
      }
    }
  })
}
