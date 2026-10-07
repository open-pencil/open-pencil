import * as v from 'valibot'

export const nodeIdInput = v.pipe(v.string(), v.description('Node ID'))
export const nodeInput = v.object({ id: nodeIdInput })
export const nodeComparisonInput = v.object({
  from: v.pipe(v.string(), v.description('Source node ID')),
  to: v.pipe(v.string(), v.description('Target node ID'))
})

export function nodeTraversalInput(depthDescription: string) {
  return v.object({
    id: nodeIdInput,
    depth: v.optional(toolNumber(v.pipe(v.number(), v.description(depthDescription))))
  })
}
export const positionInputs = {
  x: toolNumber(v.pipe(v.number(), v.description('X position in the parent, or on the page'))),
  y: toolNumber(v.pipe(v.number(), v.description('Y position in the parent, or on the page')))
}

/** Reuse a native number schema for both numeric and numeric-string agent inputs. */
export function toolNumber(schema: v.GenericSchema<number, number> = v.number()) {
  // JSON Schema numbers are finite. Express that with representable bounds as well as at runtime.
  const finite = v.pipe(schema, v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE))
  return v.union([
    finite,
    v.pipe(
      v.string(),
      v.regex(/\S/, 'Expected a nonblank numeric string'),
      v.description(v.getDescription(schema) ?? 'Numeric value'),
      v.transform(Number),
      finite
    )
  ])
}
