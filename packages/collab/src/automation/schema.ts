import * as v from 'valibot'

/**
 * How a server has an editor run its commands, such as a design tool an MCP client called: the
 * local MCP server over its socket, and a Cloud relay over a room's `agent-tools` channel. The
 * editor registers to run them, takes requests, and answers each with a response of the same id;
 * a request the server stopped waiting for is cancelled, so one still waiting for its turn never
 * runs.
 */

const idSchema = v.pipe(v.string(), v.nonEmpty())

/**
 * An editor offering to run requests, with the token the server asked for, if any. A server sends
 * one without a token to invite the editor to register.
 */
export const automationRegisterSchema = v.object({
  type: v.literal('register'),
  token: v.optional(v.nullable(v.string()))
})

/** A command for the editor, such as `tool` with the tool's name, arguments, and agent. */
export const automationRequestSchema = v.object({
  type: v.literal('request'),
  id: idSchema,
  command: v.string(),
  args: v.optional(v.unknown())
})
export type AutomationRequest = v.InferOutput<typeof automationRequestSchema>

/** The server stopped waiting for a request. */
export const automationCancelSchema = v.object({ type: v.literal('cancel'), id: idSchema })

/**
 * The editor's answer to a request: what the command answered, such as `result` and the `target`
 * it worked on, or `ok: false` with the error.
 */
export const automationResponseSchema = v.looseObject({
  type: v.literal('response'),
  id: idSchema,
  ok: v.optional(v.boolean()),
  result: v.optional(v.unknown()),
  error: v.optional(v.string())
})
export type AutomationResponse = v.InferOutput<typeof automationResponseSchema>

export const automationMessageSchema = v.variant('type', [
  automationRegisterSchema,
  automationRequestSchema,
  automationCancelSchema,
  automationResponseSchema
])
export type AutomationMessage = v.InferOutput<typeof automationMessageSchema>

/** A message as a socket carries it, in JSON text. */
export const automationMessageTextSchema = v.pipe(
  v.string(),
  v.parseJson(),
  automationMessageSchema
)
