import { es, jsx, type SyntaxNode } from '@open-pencil/emit'

/** A paint, effect, or variable helper call inside a prop value, such as `solid("#FF0000")`. */
export class HelperCall {
  constructor(
    readonly helper: string,
    readonly args: JSXValue[]
  ) {}
}

/** A prop value: plain data, possibly holding helper calls. Undefined object fields are left out. */
export type JSXValue =
  | string
  | number
  | boolean
  | null
  | HelperCall
  | JSXValue[]
  | { [key: string]: JSXValue | undefined }

/** A prop name and its value. */
export type JSXProp = [name: string, value: JSXValue]

/** A call with trailing undefined arguments dropped, so defaults stay implicit. */
export function helperCall(helper: string, ...args: (JSXValue | undefined)[]): HelperCall {
  const last = args.findLastIndex((arg) => arg !== undefined)
  return new HelperCall(
    helper,
    args.slice(0, last + 1).map((arg) => arg ?? null)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Plain scene data, such as a paint with no helper, as a prop value. Throws on values JSX
 * cannot write back, such as binary data.
 */
export function plainValue(value: unknown): JSXValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(plainValue)
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) =>
        item === undefined ? [] : [[key, plainValue(item)]]
      )
    )
  }
  throw new TypeError(`Cannot write a ${typeof value} value as JSX`)
}

/** The expression for a value, printed through the emit builders. */
export function valueSyntax(value: JSXValue): SyntaxNode {
  if (value === null) return { type: 'Literal', value: null }
  if (value instanceof HelperCall) return es.call(value.helper, value.args.map(valueSyntax))
  if (Array.isArray(value)) return es.array(value.map(valueSyntax))
  if (typeof value === 'object') {
    return es.object(
      Object.entries(value).flatMap(([key, item]) =>
        item === undefined ? [] : [[key, valueSyntax(item)] as const]
      )
    )
  }
  return jsx.literal(value)
}
