import { tsPlugin } from '@sveltejs/acorn-typescript'
import { Parser } from 'acorn'
import { print } from 'esrap'
import ts from 'esrap/languages/ts'

/** An ESTree or TS-ESTree node, as acorn parses it and esrap prints it. */
export interface SyntaxNode {
  type: string
  [key: string]: unknown
}

const TSParser = Parser.extend(tsPlugin())

/** Whether a value is a syntax node, as opposed to a primitive field of one. */
export function isNode(value: unknown): value is SyntaxNode {
  return typeof value === 'object' && value !== null && 'type' in value
}

/** The node under `key`, or undefined when it is absent or not a node. */
export function child(node: SyntaxNode | undefined, key: string): SyntaxNode | undefined {
  const value = node?.[key]
  return isNode(value) ? value : undefined
}

export function children(node: SyntaxNode | undefined, key: string): SyntaxNode[] {
  const value = node?.[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}

export function parseModule(source: string): SyntaxNode & { body: SyntaxNode[] } {
  const program: unknown = TSParser.parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
  if (!isNode(program)) throw new Error('Expected a module')
  return { ...program, body: children(program, 'body') }
}

export function parseExpression(source: string): SyntaxNode {
  const expression = child(parseModule(`(${source})`).body.at(0), 'expression')
  if (!expression) throw new Error(`Expected an expression: ${source}`)
  return expression
}

export function parseType(source: string): SyntaxNode {
  const type = child(parseModule(`type T = ${source}`).body.at(0), 'typeAnnotation')
  if (!type) throw new Error(`Expected a type: ${source}`)
  return type
}

/** A hole value that removes the object property holding it. */
export const OMIT = Symbol('omit')

/**
 * Replace `$name` placeholders — identifiers, type references, and string literals — with
 * nodes. A property whose value is filled with `OMIT` is removed.
 */
export function fill<T extends SyntaxNode>(
  template: T,
  holes: Record<string, SyntaxNode | typeof OMIT>
): T {
  const hole = (name: unknown) => (typeof name === 'string' ? holes[name] : undefined)
  const holeOf = (node: SyntaxNode) => {
    if (node.type === 'Identifier') return hole(node.name)
    if (node.type === 'Literal') return hole(node.value)
    if (node.type === 'TSTypeReference') return hole(child(node, 'typeName')?.name)
    return undefined
  }
  const omitted = (node: unknown) =>
    isNode(node) && node.type === 'Property' && hole(child(node, 'value')?.name) === OMIT
  const replacement = (node: SyntaxNode): SyntaxNode | undefined => {
    const value = holeOf(node)
    if (!value || value === OMIT) return undefined
    // `$name: Story` keeps its annotation when the identifier is filled, with its own holes filled.
    const annotation = child(node, 'typeAnnotation')
    return annotation
      ? { ...structuredClone(value), typeAnnotation: visit(annotation) }
      : structuredClone(value)
  }
  function visit(node: SyntaxNode): SyntaxNode {
    const filled = replacement(node)
    if (filled) return filled
    const copy: SyntaxNode = { ...node }
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value))
        copy[key] = value
          .filter((item) => !omitted(item))
          .map((item) => (isNode(item) ? visit(item) : item))
      else if (isNode(value)) copy[key] = visit(value)
    }
    return copy
  }
  return visit(template) as T
}

export function printModule(program: SyntaxNode): string {
  return print(program, ts(), { indent: '  ' }).code
}

/** One expression, as a template binding or another host language embeds it. */
export function printExpression(expression: SyntaxNode): string {
  const program = {
    type: 'Program',
    sourceType: 'module',
    body: [{ type: 'ExpressionStatement', expression }]
  }
  return printModule(program).trim().replace(/;$/, '')
}

export const identifier = (name: string): SyntaxNode => ({ type: 'Identifier', name })

export const string = (value: string): SyntaxNode => ({ type: 'Literal', value })

/** A finite number, with a negative one written as `-` before its magnitude, as source does. */
export function number(value: number): SyntaxNode {
  if (!Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`)
  const literal = { type: 'Literal', value: Math.abs(value) }
  return value < 0
    ? { type: 'UnaryExpression', operator: '-', prefix: true, argument: literal }
    : literal
}

const propertyKey = (key: string) =>
  /^[A-Za-z_$][\w$]*$/.test(key) ? identifier(key) : string(key)

export function object(entries: (readonly [string, SyntaxNode])[]): SyntaxNode {
  return {
    type: 'ObjectExpression',
    properties: entries.map(([key, value]) => ({
      type: 'Property',
      kind: 'init',
      key: propertyKey(key),
      value,
      computed: false,
      method: false,
      shorthand: false
    }))
  }
}

export const array = (elements: SyntaxNode[]): SyntaxNode => ({ type: 'ArrayExpression', elements })

/** A call of a function by name, such as a helper inside an exported prop value. */
export const call = (callee: string, args: SyntaxNode[]): SyntaxNode => ({
  type: 'CallExpression',
  callee: identifier(callee),
  arguments: args,
  optional: false
})

export function stringUnionType(values: string[]): SyntaxNode {
  const literals = values.map((value) => ({ type: 'TSLiteralType', literal: string(value) }))
  return literals.length === 1 && literals[0]
    ? literals[0]
    : { type: 'TSUnionType', types: literals }
}

/** An object type; a member whose third element is `true` is optional. */
export function objectType(entries: [string, SyntaxNode, boolean?][]): SyntaxNode {
  return {
    type: 'TSTypeLiteral',
    members: entries.map(([key, typeAnnotation, optional = false]) => ({
      type: 'TSPropertySignature',
      key: propertyKey(key),
      computed: false,
      optional,
      typeAnnotation: { type: 'TSTypeAnnotation', typeAnnotation }
    }))
  }
}
