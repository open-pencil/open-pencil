import { Allow, parseJSON } from 'partial-json'
import * as v from 'valibot'

const coordinate = v.optional(v.pipe(v.number(), v.finite()))
const schema = v.object({
  jsx: v.string(),
  parent_id: v.optional(v.string()),
  replace_id: v.optional(v.string()),
  insert_index: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  x: coordinate,
  y: coordinate
})

export type RenderPreviewInput = v.InferOutput<typeof schema>

export function readPreviewInput(source: string): RenderPreviewInput | null {
  try {
    // Omit unfinished numbers rather than guessing coordinates (for example x: 1e).
    const value: unknown = parseJSON(source, Allow.STR | Allow.OBJ)
    const result = v.safeParse(schema, value)
    return result.success ? result.output : null
  } catch {
    return null
  }
}
