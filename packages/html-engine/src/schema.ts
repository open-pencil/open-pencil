import * as v from 'valibot'

const rectSchema = v.tuple([v.number(), v.number(), v.number(), v.number()])

const glyphRunSchema = v.object({
  /** The engine's id of the node whose text the run draws. */
  node: v.number(),
  x: v.number(),
  width: v.number(),
  text: v.string()
})

const inlineBoxRunSchema = v.object({
  /** The engine's id of the atomic inline, such as an `inline-block`, the line holds. */
  box: v.number(),
  x: v.number(),
  width: v.number()
})

const lineSchema = v.object({
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
  baseline: v.number(),
  runs: v.array(v.union([glyphRunSchema, inlineBoxRunSchema]))
})

const capturedNodeSchema = v.object({
  /** The engine's own id, which runs and inline boxes refer to. */
  id: v.number(),
  /** The index in `nodes` of the element holding it. */
  parent: v.optional(v.number()),
  /** Set on text nodes, which carry nothing else. */
  text: v.optional(v.string()),
  /** The element's local name, or `::before` and `::after` for generated content. */
  tag: v.optional(v.string()),
  /** Attributes by name, namespaced ones with their prefix, as `xlink:href`. */
  attrs: v.optional(v.record(v.string(), v.string())),
  /** The border box, in page pixels. */
  box: v.optional(rectSchema),
  /** What the image element holds, such as `raster 640x480` or `svg`. */
  image: v.optional(v.string()),
  /**
   * Computed values: those with a fixed initial value only when they differ from it, and always
   * the ones whose initial value depends on the element or is inherited, such as `display`,
   * `color`, sizes, and font properties.
   */
  style: v.optional(v.record(v.string(), v.string())),
  /** An inline element's box on each line it spans, in page pixels. */
  fragments: v.optional(v.array(rectSchema)),
  /** The lines of the inline formatting context the element holds, in page pixels. */
  lines: v.optional(v.array(lineSchema))
})

/** The document the engine laid out: every node, parents before children. */
export const captureSchema = v.object({
  engine: v.literal('blitz'),
  viewport: v.tuple([v.number(), v.number()]),
  /** The initial values of the properties nodes leave out of `style` when they hold them. */
  initial: v.record(v.string(), v.string()),
  nodes: v.array(capturedNodeSchema)
})

/** The resources the document is waiting for, as `[request id, URL]` pairs. */
export const requestsSchema = v.array(v.tuple([v.number(), v.string()]))

export type HTMLEngineCapture = v.InferOutput<typeof captureSchema>
export type HTMLEngineNode = v.InferOutput<typeof capturedNodeSchema>
export type HTMLEngineLine = v.InferOutput<typeof lineSchema>
