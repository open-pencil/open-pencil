import * as v from 'valibot'

import { validateVectorNetwork } from '@open-pencil/scene-graph'
import type { VectorNetwork } from '@open-pencil/scene-graph'

const finiteNumber = v.pipe(v.number(), v.finite())
const zeroVector = () => ({ x: 0, y: 0 })
const point = v.object({ x: finiteNumber, y: finiteNumber })

const VectorNetworkShape = v.object({
  vertices: v.array(
    v.object({
      x: finiteNumber,
      y: finiteNumber,
      strokeCap: v.optional(v.string()),
      strokeJoin: v.optional(v.string()),
      cornerRadius: v.optional(finiteNumber),
      handleMirroring: v.optional(v.picklist(['NONE', 'ANGLE', 'ANGLE_AND_LENGTH']))
    })
  ),
  segments: v.array(
    v.object({
      start: v.pipe(v.number(), v.integer()),
      end: v.pipe(v.number(), v.integer()),
      tangentStart: v.optional(point, zeroVector),
      tangentEnd: v.optional(point, zeroVector)
    })
  ),
  regions: v.optional(
    v.array(
      v.object({
        windingRule: v.picklist(['NONZERO', 'EVENODD']),
        loops: v.array(v.array(v.pipe(v.number(), v.integer())))
      })
    ),
    () => []
  )
})

/**
 * VectorNetwork JSON from a tool argument. Index ranges and region chains are checked by
 * `validateVectorNetwork`; the shape schema then types the value and fills missing tangents
 * and regions.
 */
const VectorNetworkJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.rawCheck<unknown>(({ dataset, addIssue }) => {
    if (!dataset.typed) return
    for (const message of validateVectorNetwork(dataset.value)) addIssue({ message })
  }),
  VectorNetworkShape
)

export type VectorNetworkJSONResult = { network: VectorNetwork } | { error: string }

/** Parse and validate VectorNetwork JSON, returning a tool error instead of throwing. */
export function parseVectorNetworkJSON(text: string): VectorNetworkJSONResult {
  const result = v.safeParse(VectorNetworkJSON, text)
  if (result.success) return { network: result.output }
  if (result.issues.some((issue) => issue.type === 'parse_json'))
    return { error: 'Invalid VectorNetwork JSON' }
  return {
    error: `Invalid VectorNetwork: ${result.issues.map((issue) => issue.message).join('; ')}`
  }
}
