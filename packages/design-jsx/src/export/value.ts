import { isUndefined, mapValues, omitBy } from 'es-toolkit'

import { es, jsx, type SyntaxNode } from '@open-pencil/emit'

/** A paint, effect, or variable helper call inside a prop value, such as `solid("#FF0000")`. */
export class HelperCall {
  constructor(
    readonly helper: string,
    readonly args: JSXValue[]
  ) {}
}

/**
 * A name the export declares before the JSX, such as the `card1` of `ref={card1}`, or one of its
 * members, such as the `theme.Page` of a variable `defineVars` declared.
 */
export class Reference {
  constructor(
    readonly name: string,
    readonly member?: string
  ) {}
}

/** A prop value: plain data, possibly holding helper calls. Undefined object fields are left out. */
export type JSXValue =
  | string
  | number
  | boolean
  | null
  | HelperCall
  | Reference
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
  if (value instanceof Reference) return value
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(plainValue)
  if (isRecord(value)) {
    return mapValues(omitBy(value, isUndefined), (item) => plainValue(item))
  }
  throw new TypeError(`Cannot write a ${typeof value} value as JSX`)
}

/** The expression for a value, printed through the emit builders. */
export function valueSyntax(value: JSXValue): SyntaxNode {
  if (value === null) return { type: 'Literal', value: null }
  if (value instanceof HelperCall) return es.call(value.helper, value.args.map(valueSyntax))
  if (value instanceof Reference)
    return value.member === undefined
      ? es.identifier(value.name)
      : es.member(es.identifier(value.name), value.member)
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

function propValue(value: JSXValue): SyntaxNode | null {
  if (value === true) return null
  if (typeof value === 'string') return jsx.stringValue(value)
  return jsx.container(valueSyntax(value))
}

/**
 * A prop as a JSX attribute: `true` prints the bare name, strings as attribute strings, and
 * other values as expressions, with paint and effect helpers as calls.
 */
export function propAttribute([name, value]: JSXProp): SyntaxNode {
  return jsx.attribute(name, propValue(value))
}
