import * as v from 'valibot'

import { automationMessageTextSchema, type AutomationMessage } from './schema'

export {
  automationCancelSchema,
  automationMessageSchema,
  automationMessageTextSchema,
  automationRegisterSchema,
  automationRequestSchema,
  automationResponseSchema,
  type AutomationMessage,
  type AutomationRequest,
  type AutomationResponse
} from './schema'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** A message as a room channel carries it. */
export function encodeAutomationMessage(message: AutomationMessage): Uint8Array {
  return encoder.encode(JSON.stringify(message))
}

/** The message a room payload carries, or null when it is not one. */
export function decodeAutomationMessage(payload: Uint8Array): AutomationMessage | null {
  const parsed = v.safeParse(automationMessageTextSchema, decoder.decode(payload))
  return parsed.success ? parsed.output : null
}
