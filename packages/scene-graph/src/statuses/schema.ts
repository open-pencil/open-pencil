import * as v from 'valibot'

/** Figma's own statuses, `DevStatus['type']` in the Plugin API. */
export const FIGMA_DEV_STATUSES = ['READY_FOR_DEV', 'COMPLETED'] as const
export type FigmaDevStatus = (typeof FIGMA_DEV_STATUSES)[number]

const colorSchema = v.object({
  r: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  g: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  b: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  a: v.pipe(v.number(), v.minValue(0), v.maxValue(1))
})

const statusStateSchema = v.object({
  id: v.pipe(v.string(), v.nonEmpty()),
  name: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(100)),
  color: colorSchema
})

/** One status a document's layers can be in. */
export type StatusState = v.InferOutput<typeof statusStateSchema>

/** A document's statuses, in the order menus list them. */
export const statusWorkflowSchema = v.pipe(
  v.object({
    /** The preset the states started from, so the editor can name it while they still match. */
    preset: v.optional(v.string()),
    states: v.pipe(v.array(statusStateSchema), v.minLength(1))
  }),
  v.check(
    ({ states }) => new Set(states.map((state) => state.id)).size === states.length,
    'Status ids must be unique'
  )
)

export type StatusWorkflow = v.InferOutput<typeof statusWorkflowSchema>

/** A layer's status: the id of a state in the document's workflow. */
export const nodeStatusSchema = v.pipe(v.string(), v.nonEmpty())
