import * as v from 'valibot'

/** The channel a presentation and its presenter's window talk on, by the presentation's ID. */
export function presenterChannelName(presentationId: string): string {
  return `openpencil-presenter:${presentationId}`
}

const slideSchema = v.object({
  id: v.string(),
  /** Its number among the slides presented. */
  number: v.number(),
  thumbnail: v.nullable(v.string()),
  notes: v.string()
})

/** Where the presentation is, as the window presenting it tells its presenter. */
export const presenterStatusSchema = v.object({
  type: v.literal('status'),
  title: v.string(),
  slides: v.array(slideSchema),
  index: v.number(),
  played: v.number(),
  steps: v.number(),
  startedAt: v.number()
})
export type PresenterStatus = v.InferOutput<typeof presenterStatusSchema>
export type PresenterSlide = v.InferOutput<typeof slideSchema>

/** What the presenting window tells its presenter: where it is, or that it ended. */
export const presenterUpdateSchema = v.variant('type', [
  presenterStatusSchema,
  v.object({ type: v.literal('ended') })
])
export type PresenterUpdate = v.InferOutput<typeof presenterUpdateSchema>

/** What the presenter asks of the presenting window. */
export const presenterCommandSchema = v.variant('type', [
  v.object({ type: v.literal('hello') }),
  v.object({ type: v.literal('next') }),
  v.object({ type: v.literal('previous') }),
  v.object({ type: v.literal('slide'), index: v.number() }),
  v.object({ type: v.literal('stop') })
])
export type PresenterCommand = v.InferOutput<typeof presenterCommandSchema>
