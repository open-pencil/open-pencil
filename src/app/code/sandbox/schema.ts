/**
 * The messages the host, the sandbox frame, and its worker exchange. Each side parses what it
 * receives, as a message can come from any frame or script.
 */
import * as v from 'valibot'

const designJSXValidationLimitsSchema = v.object({
  outputBytes: v.number(),
  elements: v.number(),
  depth: v.number(),
  arrayLength: v.number(),
  objectKeys: v.number(),
  stringLength: v.number()
})

export type DesignJSXValidationLimits = v.InferOutput<typeof designJSXValidationLimitsSchema>

export const SANDBOX_READY = 'open-pencil-design-jsx-ready'
export const SANDBOX_RUN = 'open-pencil-design-jsx-run'
export const SANDBOX_RESULT = 'open-pencil-design-jsx-result'

const runRequestEntries = {
  id: v.string(),
  code: v.string(),
  /** Element names, such as `Frame` or `Button.Root`, by the runtime type they create. */
  elements: v.record(v.string(), v.string()),
  helpers: v.array(v.string()),
  limits: designJSXValidationLimitsSchema
}

const resultEntries = {
  succeeded: {
    id: v.string(),
    ok: v.literal(true),
    value: v.unknown(),
    collections: v.array(v.unknown())
  },
  failed: { id: v.string(), ok: v.literal(false), error: v.string() }
}

/** What the host asks the sandbox to run. */
const sandboxRunRequestSchema = v.object(runRequestEntries)
export type SandboxRunRequest = v.InferOutput<typeof sandboxRunRequestSchema>

/** What the worker reports for a run. */
export const sandboxRunResultSchema = v.variant('ok', [
  v.object(resultEntries.succeeded),
  v.object(resultEntries.failed)
])
export type SandboxRunResult = v.InferOutput<typeof sandboxRunResultSchema>

/** A message the host sends the frame. */
export const sandboxHostMessageSchema = v.object({
  type: v.literal(SANDBOX_RUN),
  ...runRequestEntries
})

/** A message the frame sends the host. */
export const sandboxFrameMessageSchema = v.variant('type', [
  v.object({ type: v.literal(SANDBOX_READY) }),
  v.variant('ok', [
    v.object({ type: v.literal(SANDBOX_RESULT), ...resultEntries.succeeded }),
    v.object({ type: v.literal(SANDBOX_RESULT), ...resultEntries.failed })
  ])
])
