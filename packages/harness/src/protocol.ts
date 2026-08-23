export type JSONPrimitive = null | boolean | number | string
export type JSONValue = JSONPrimitive | JSONValue[] | { [key: string]: JSONValue }

export const HARNESS_ADAPTER_IDS = ['pi'] as const
export const HARNESS_SANDBOX_IDS = ['just-bash'] as const

export type HarnessAdapterID = (typeof HARNESS_ADAPTER_IDS)[number]
export type HarnessSandboxID = (typeof HARNESS_SANDBOX_IDS)[number]

export interface HarnessSessionConfiguration {
  adapter: HarnessAdapterID
  sandbox: HarnessSandboxID
  model: string
  settings?: Record<string, JSONValue>
  mcpServers?: Record<string, Record<string, JSONValue>>
  instructions?: string
}

export interface HarnessProviderCapability {
  adapter: HarnessAdapterID
  sandboxes: readonly HarnessSandboxID[]
  structuredOutput: boolean
  sessionResume: 'live-process' | 'persistent'
  turnContinuation: boolean
}

export interface HarnessTurnInput {
  sessionId: string
  prompt: string
}

export type HarnessRequest =
  | {
      id: string
      method: 'service.capabilities'
      params?: Record<string, never>
    }
  | {
      id: string
      method: 'session.create'
      params: { sessionId: string; configuration: HarnessSessionConfiguration }
    }
  | { id: string; method: 'session.turn'; params: HarnessTurnInput }
  | { id: string; method: 'session.cancel'; params: { sessionId: string } }
  | { id: string; method: 'session.stop'; params: { sessionId: string } }
  | { id: string; method: 'session.destroy'; params: { sessionId: string } }
  | { id: string; method: 'service.shutdown'; params?: Record<string, never> }

export type HarnessTurnEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: JSONValue }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: JSONValue }
  | { type: 'finish'; finishReason: string }
  | { type: 'error'; message: string }

export type HarnessSidecarMessage =
  | { type: 'response'; id: string; result?: JSONValue; error?: string }
  | { type: 'turn.event'; id: string; event: HarnessTurnEvent }

export const MAX_PROTOCOL_LINE_BYTES = 1024 * 1024
export const MAX_PROMPT_LENGTH = 256 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected non-empty string at ${key}`)
  }
  return value
}

function isAdapterID(value: unknown): value is HarnessAdapterID {
  return typeof value === 'string' && HARNESS_ADAPTER_IDS.includes(value as HarnessAdapterID)
}

function isSandboxID(value: unknown): value is HarnessSandboxID {
  return typeof value === 'string' && HARNESS_SANDBOX_IDS.includes(value as HarnessSandboxID)
}

function parseJSONRecord(value: unknown, field: string): Record<string, JSONValue> | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`Expected object at ${field}`)
  try {
    JSON.stringify(value)
    return structuredClone(value) as Record<string, JSONValue>
  } catch {
    throw new Error(`Expected JSON-compatible object at ${field}`)
  }
}

function parseConfiguration(value: unknown): HarnessSessionConfiguration {
  if (!isRecord(value)) throw new Error('Expected Harness session configuration')
  if (!isAdapterID(value.adapter)) throw new Error('Unknown Harness adapter')
  if (!isSandboxID(value.sandbox)) throw new Error('Unknown Harness sandbox')
  const mcpServers = parseJSONRecord(value.mcpServers, 'mcpServers')
  return {
    adapter: value.adapter,
    sandbox: value.sandbox,
    model: requireString(value, 'model'),
    ...(parseJSONRecord(value.settings, 'settings')
      ? { settings: parseJSONRecord(value.settings, 'settings') }
      : {}),
    ...(mcpServers ? { mcpServers: mcpServers as Record<string, Record<string, JSONValue>> } : {}),
    ...(typeof value.instructions === 'string' ? { instructions: value.instructions } : {})
  }
}

function parseSessionParams(value: unknown): { sessionId: string } {
  if (!isRecord(value)) throw new Error('Expected request params')
  return { sessionId: requireString(value, 'sessionId') }
}

export function parseHarnessRequest(line: string): HarnessRequest {
  if (Buffer.byteLength(line, 'utf8') > MAX_PROTOCOL_LINE_BYTES) {
    throw new Error('Harness request exceeds the protocol size limit')
  }

  const parsed: unknown = JSON.parse(line)
  if (!isRecord(parsed)) throw new Error('Expected a request object')
  const id = requireString(parsed, 'id')
  const method = requireString(parsed, 'method')

  if (method === 'service.capabilities' || method === 'service.shutdown') {
    return { id, method, params: {} }
  }
  if (method === 'session.create') {
    const params = parseSessionParams(parsed.params)
    if (!isRecord(parsed.params)) throw new Error('Expected request params')
    return {
      id,
      method,
      params: { ...params, configuration: parseConfiguration(parsed.params.configuration) }
    }
  }
  if (method === 'session.cancel' || method === 'session.stop' || method === 'session.destroy') {
    return { id, method, params: parseSessionParams(parsed.params) }
  }
  if (method === 'session.turn') {
    if (!isRecord(parsed.params)) throw new Error('Expected request params')
    const sessionId = requireString(parsed.params, 'sessionId')
    const prompt = requireString(parsed.params, 'prompt')
    if (prompt.length > MAX_PROMPT_LENGTH) throw new Error('Harness prompt exceeds the size limit')
    return { id, method, params: { sessionId, prompt } }
  }
  throw new Error(`Unknown harness method: ${method}`)
}
