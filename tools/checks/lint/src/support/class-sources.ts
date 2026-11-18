import type {
  Argument,
  ArrayExpressionElement,
  CallExpression,
  Expression,
  ObjectExpression,
  ObjectPropertyKind,
  Program,
  TemplateLiteral
} from '@oxc-project/types'
import { Visitor, parseSync } from 'oxc-parser'

/** A class list found in source, with its offsets in the text it was read from. */
export interface ClassText {
  text: string
  start: number
  end: number
}

export interface ClassVisitor {
  text?(found: ClassText): void
  /** A template literal that builds a class list by interpolation. */
  interpolated?(literal: TemplateLiteral): void
}

/** Keys whose value is a class list where the other keys of the object are not. */
const CLASS_KEYS = new Set(['class', 'className'])
const CLASS_HELPERS = new Set(['tv', 'twMerge', 'twJoin'])

type ValueNode = Expression | ArrayExpressionElement | Argument | null
type ObjectVisit = (object: ObjectExpression) => void

function keyName(property: ObjectPropertyKind): string | null {
  if (property.type !== 'Property' || property.computed) return null
  const { key } = property
  if (key.type === 'Identifier') return key.name
  return key.type === 'Literal' && typeof key.value === 'string' ? key.value : null
}

/** The expression inside parentheses and TypeScript's `as`, `satisfies`, and `!`. */
function unwrap(node: ValueNode): ValueNode {
  let inner = node
  while (
    inner?.type === 'ParenthesizedExpression' ||
    inner?.type === 'TSAsExpression' ||
    inner?.type === 'TSSatisfiesExpression' ||
    inner?.type === 'TSNonNullExpression'
  )
    inner = inner.expression
  return inner
}

function visitTemplateLiteral(literal: TemplateLiteral, visitor: ClassVisitor): void {
  if (literal.expressions.length > 0) visitor.interpolated?.(literal)
  for (const quasi of literal.quasis) {
    const text = quasi.value.cooked ?? quasi.value.raw
    visitor.text?.({ text, start: quasi.start, end: quasi.end })
  }
}

/**
 * The strings standing where a class list goes: a string or template literal, array items, both
 * branches of `?:`, the right side of `&&` and both sides of `||` and `??`. A compared value, a
 * call's arguments, or a variable is not one. `objects` reads an object in that place.
 */
function visitValue(value: ValueNode, visitor: ClassVisitor, objects?: ObjectVisit): void {
  const node = unwrap(value)
  if (!node) return
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string')
        visitor.text?.({ text: node.value, start: node.start, end: node.end })
      return
    case 'TemplateLiteral':
      visitTemplateLiteral(node, visitor)
      return
    case 'ArrayExpression':
      for (const element of node.elements) visitValue(element, visitor, objects)
      return
    case 'SpreadElement':
      visitValue(node.argument, visitor, objects)
      return
    case 'ConditionalExpression':
      visitValue(node.consequent, visitor, objects)
      visitValue(node.alternate, visitor, objects)
      return
    case 'LogicalExpression':
      if (node.operator !== '&&') visitValue(node.left, visitor, objects)
      visitValue(node.right, visitor, objects)
      return
    case 'ObjectExpression':
      objects?.(node)
      break
    default:
  }
}

/** Only the `class` of an object is a class list: a compound variant, or what `tv` returns. */
function visitClassKey(object: ObjectExpression, visitor: ClassVisitor): void {
  for (const property of object.properties) {
    const key = keyName(property)
    if (property.type === 'Property' && key !== null && CLASS_KEYS.has(key))
      visitTheme(property.value, visitor)
  }
}

/**
 * A tailwind-variants theme: slots, base, and variants map to class lists at any depth;
 * `defaultVariants` selects variants, and of a `compoundVariants` entry only `class` is classes.
 */
function visitTheme(node: ValueNode, visitor: ClassVisitor): void {
  visitValue(node, visitor, (object) => {
    for (const property of object.properties) {
      if (property.type === 'SpreadElement') {
        visitTheme(property.argument, visitor)
        continue
      }
      const key = keyName(property)
      if (key === 'defaultVariants') continue
      if (key === 'compoundVariants' && property.value.type === 'ArrayExpression') {
        for (const entry of property.value.elements)
          if (entry?.type === 'ObjectExpression') visitClassKey(entry, visitor)
        continue
      }
      visitTheme(property.value, visitor)
    }
  })
}

/**
 * Every class list of a theme module: its default export and its module-level constants, which
 * themes share as slot pieces (`motionStyles.spinner`). Functions, such as CodeMirror themes
 * built from CSS values, are not themes.
 */
export function visitThemeModule(program: Program, visitor: ClassVisitor): void {
  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      const { declaration } = statement
      if (
        declaration.type === 'ObjectExpression' ||
        declaration.type === 'TSSatisfiesExpression' ||
        declaration.type === 'TSAsExpression'
      )
        visitTheme(declaration, visitor)
      continue
    }
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
    if (declaration?.type !== 'VariableDeclaration') continue
    for (const declarator of declaration.declarations) visitTheme(declarator.init, visitor)
  }
}

function isHelperName(callee: Expression): boolean {
  return callee.type === 'Identifier' && CLASS_HELPERS.has(callee.name)
}

/**
 * The class lists of a `tv`, `twMerge`, or `twJoin` call; for a call of what `tv` returns,
 * `tv(theme)({ size, class: [...] })`, only its `class`. Returns whether the call is one.
 */
export function visitHelperCall(call: CallExpression, visitor: ClassVisitor): boolean {
  const { callee } = call
  if (isHelperName(callee)) {
    for (const argument of call.arguments) visitTheme(argument, visitor)
    return true
  }
  if (callee.type !== 'CallExpression' || !isHelperName(callee.callee)) return false
  for (const argument of call.arguments)
    if (argument.type === 'ObjectExpression') visitClassKey(argument, visitor)
  return true
}

/**
 * The class lists of a Vue binding, parsed as the expression it is: in `:class` an object's keys
 * are classes and its values conditions (`{ 'text-muted': idle }`); in `:ui` each slot's value is
 * a class list. A binding that does not parse has none.
 */
export function visitTemplateBinding(
  arg: 'class' | 'ui',
  source: string,
  visitor: ClassVisitor
): void {
  const { program, errors } = parseSync('binding.ts', `(${source})`)
  const [statement] = program.body
  if (errors.length > 0 || statement?.type !== 'ExpressionStatement') return
  if (arg === 'class') {
    visitValue(statement.expression, visitor, (object) => {
      for (const property of object.properties) {
        const key = keyName(property)
        if (property.type === 'Property' && key !== null)
          visitor.text?.({ text: key, start: property.key.start, end: property.key.end })
      }
    })
    return
  }
  const slots: ObjectVisit = (object) => {
    for (const property of object.properties)
      if (property.type === 'Property') visitValue(property.value, visitor)
  }
  visitValue(statement.expression, visitor, slots)
}

/**
 * Every class list in a script: a theme module's, or elsewhere those of its class helper calls.
 * `source` is the script oxlint lints (a Vue file's `<script>`); offsets are into it.
 */
export function visitScript(
  source: string,
  file: string,
  themeModule: boolean,
  visitor: ClassVisitor
): void {
  const lang = file.endsWith('x') ? 'tsx' : 'ts'
  const { program, errors } = parseSync(`script.${lang}`, source)
  if (errors.length > 0) return
  if (themeModule) {
    visitThemeModule(program, visitor)
    return
  }
  new Visitor({ CallExpression: (call) => void visitHelperCall(call, visitor) }).visit(program)
}
