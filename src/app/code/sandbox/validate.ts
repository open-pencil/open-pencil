const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

type ValidationLimits = {
  outputBytes: number
  elements: number
  depth: number
  arrayLength?: number
  objectKeys?: number
  stringLength?: number
}

type ValidationState = {
  elements: number
  bytes: number
}

type PlainRecord = { [key: string]: unknown }

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function addBytes(state: ValidationState, limits: ValidationLimits, bytes: number): void {
  state.bytes += bytes
  if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
}

function validatePrimitive(
  value: unknown,
  limits: ValidationLimits,
  state: ValidationState
): boolean {
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Design JSX output contains an invalid number.')
    return true
  }
  if (typeof value === 'string') {
    if (limits.stringLength !== undefined && value.length > limits.stringLength) {
      throw new Error('Design JSX output contains a string that is too long.')
    }
    addBytes(state, limits, new TextEncoder().encode(value).byteLength)
    return true
  }
  return false
}

function validateRecord(
  record: PlainRecord,
  limits: ValidationLimits,
  state: ValidationState,
  depth: number
): void {
  const keys = Object.keys(record)
  if (limits.objectKeys !== undefined && keys.length > limits.objectKeys) {
    throw new Error('Design JSX output contains too many object properties.')
  }
  for (const key of keys) {
    if (BLOCKED_KEYS.has(key)) throw new Error(`Design JSX output contains blocked key "${key}".`)
  }
  if ('type' in record && 'props' in record && 'children' in record) {
    state.elements += 1
    if (state.elements > limits.elements)
      throw new Error('Design JSX output has too many elements.')
  }
  for (const [key, item] of Object.entries(record)) {
    addBytes(state, limits, key.length)
    validateValue(item, limits, state, depth + 1)
  }
}

function validateValue(
  value: unknown,
  limits: ValidationLimits,
  state: ValidationState,
  depth: number
): void {
  if (depth > limits.depth) throw new Error('Design JSX output is too deeply nested.')
  if (validatePrimitive(value, limits, state)) return
  if (Array.isArray(value)) {
    if (limits.arrayLength !== undefined && value.length > limits.arrayLength) {
      throw new Error('Design JSX output contains an array that is too long.')
    }
    for (const item of value) validateValue(item, limits, state, depth + 1)
    return
  }
  if (!isPlainRecord(value)) {
    throw new Error('Design JSX output must contain plain structured data only.')
  }
  validateRecord(value, limits, state, depth)
}

export function validateDesignJSXOutput(value: unknown, limits: ValidationLimits): unknown[] {
  const roots = Array.isArray(value) ? value : [value]
  const state: ValidationState = { elements: 0, bytes: 0 }
  validateValue(roots, limits, state, 0)
  return roots
}
