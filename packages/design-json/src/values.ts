import type { DesignJSONBytes } from '#design-json/types'
import { fromUint8Array } from 'js-base64'

import type { JSONObject } from '@open-pencil/std/json'
import { isRecord } from '@open-pencil/std/records'

/** Stands for a value JSON has no way to write, which its object or array then leaves out. */
const SKIPPED = Symbol('skipped')

/**
 * Any value a layer holds as JSON: bytes as `bytes` says, maps as objects, sets as arrays, and a
 * number that is not finite as null, as `JSON.stringify` would write it. Undefined when JSON has
 * no way to write the value, such as undefined itself or a function, or bytes left out.
 */
export function toJSONValue(value: unknown, bytes: DesignJSONBytes): unknown {
  const converted = convert(value, bytes)
  return converted === SKIPPED ? undefined : converted
}

/** An object's fields as JSON, leaving out those {@link toJSONValue} cannot write. */
export function toJSONObject(value: object, bytes: DesignJSONBytes): JSONObject {
  return convertEntries(Object.entries(value), bytes)
}

function convert(value: unknown, bytes: DesignJSONBytes): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return SKIPPED
  }
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Uint8Array) return convertBytes(value, bytes)
  if (ArrayBuffer.isView(value)) {
    return convertBytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), bytes)
  }
  if (Array.isArray(value)) return convertArray(value, bytes)
  if (value instanceof Set) return convertArray([...value], bytes)
  if (value instanceof Map) return convertEntries(value.entries(), bytes)
  if (isRecord(value)) return convertEntries(Object.entries(value), bytes)
  return SKIPPED
}

function convertBytes(data: Uint8Array, bytes: DesignJSONBytes): unknown {
  if (bytes === 'omit') return SKIPPED
  if (bytes === 'length') return { byteLength: data.byteLength }
  return { byteLength: data.byteLength, base64: fromUint8Array(data) }
}

function convertArray(values: readonly unknown[], bytes: DesignJSONBytes): unknown[] {
  const result: unknown[] = []
  for (const item of values) {
    const converted = convert(item, bytes)
    // An array keeps its positions, so a value it cannot write is null, as JSON.stringify has it.
    result.push(converted === SKIPPED ? null : converted)
  }
  return result
}

function convertEntries(
  entries: Iterable<[unknown, unknown]>,
  bytes: DesignJSONBytes
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, item] of entries) {
    const converted = convert(item, bytes)
    if (converted !== SKIPPED) result[String(key)] = converted
  }
  return result
}

/** Every string anywhere in a JSON value, which is where the IDs it references are. */
export function* stringsIn(value: unknown): Generator<string> {
  if (typeof value === 'string') {
    yield value
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) yield* stringsIn(item)
    return
  }
  if (isRecord(value)) for (const item of Object.values(value)) yield* stringsIn(item)
}
