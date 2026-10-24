import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import {
  VUE_DIRECTIVE_NODE,
  VUE_ELEMENT_NODE,
  VUE_INTERPOLATION_NODE,
  VUE_SIMPLE_EXPRESSION_NODE,
  isVueBindDirective,
  isVueSourceFile,
  vueTemplateAst,
  walkVueTemplateAst,
  type VueTemplateNode
} from '#lint/support/vue.ts'

interface ExpressionNode {
  type?: string
  name?: string
  computed?: boolean
  object?: ExpressionNode
  property?: ExpressionNode
  [key: string]: unknown
}

/** The names an expression reads, leaving out property names after a dot. */
function readNames(
  node: ExpressionNode | null | undefined,
  names = new Set<string>()
): Set<string> {
  if (!node || typeof node !== 'object') return names
  if (node.type === 'Identifier' && node.name) {
    names.add(node.name)
    return names
  }
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    readNames(node.object, names)
    if (node.computed) readNames(node.property, names)
    return names
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || !value) continue
    if (Array.isArray(value)) {
      for (const item of value) readNames(item as ExpressionNode, names)
    } else if (typeof value === 'object') {
      readNames(value as ExpressionNode, names)
    }
  }
  return names
}

function isAbsent(node: ExpressionNode | undefined): boolean {
  if (!node) return false
  if (node.type === 'NullLiteral' || (node.type === 'Literal' && node.value === null)) return true
  return node.type === 'Identifier' && node.name === 'undefined'
}

/**
 * The state an `open` expression tests for presence: `x`, `!!x`, `Boolean(x)`, `x !== null`,
 * `x != undefined`, and their `&&` combinations. Such an overlay closes by clearing that state.
 */
/** The operands a presence test reads, by expression type. */
const PRESENCE_OPERANDS: Record<string, (node: ExpressionNode) => (ExpressionNode | undefined)[]> =
  {
    // `!!x`
    UnaryExpression: (node) => {
      const inner = node.argument as ExpressionNode | undefined
      const doubled =
        node.operator === '!' && inner?.type === 'UnaryExpression' && inner.operator === '!'
      return doubled ? [inner.argument as ExpressionNode] : []
    },
    // `x !== null`, `undefined != x`
    BinaryExpression: (node) => {
      if (node.operator !== '!==' && node.operator !== '!=') return []
      const left = node.left as ExpressionNode | undefined
      const right = node.right as ExpressionNode | undefined
      if (isAbsent(right)) return [left]
      return isAbsent(left) ? [right] : []
    },
    // `a && b`
    LogicalExpression: (node) =>
      node.operator === '&&' ? [node.left as ExpressionNode, node.right as ExpressionNode] : [],
    // `Boolean(x)`
    CallExpression: (node) => {
      const callee = node.callee as ExpressionNode | undefined
      const [argument] = (node.arguments as ExpressionNode[] | undefined) ?? []
      return callee?.type === 'Identifier' && callee.name === 'Boolean' ? [argument] : []
    }
  }

function presenceNames(node: ExpressionNode | undefined, names = new Set<string>()): Set<string> {
  if (!node?.type) return names
  if (node.type === 'Identifier') {
    if (node.name && node.name !== 'undefined') names.add(node.name)
    return names
  }
  for (const operand of PRESENCE_OPERANDS[node.type]?.(node) ?? []) presenceNames(operand, names)
  return names
}

function openStateNames(expression: VueTemplateNode | null | undefined): Set<string> {
  if (expression?.type !== VUE_SIMPLE_EXPRESSION_NODE) return new Set()
  if (expression.ast) return presenceNames(expression.ast as ExpressionNode)
  return expressionNames(expression)
}

function expressionNames(expression: VueTemplateNode | null | undefined): Set<string> {
  if (expression?.type !== VUE_SIMPLE_EXPRESSION_NODE) return new Set()
  if (expression.ast) return readNames(expression.ast as ExpressionNode)
  // A bare identifier has no AST.
  return /^[A-Za-z_$][\w$]*$/.test(expression.content) ? new Set([expression.content]) : new Set()
}

function isDirective(node: VueTemplateNode, name: string): boolean {
  return node.type === VUE_DIRECTIVE_NODE && node.name === name
}

/** Bindings that decide whether the overlay is open, or run on events rather than when drawn. */
function drawsContent(prop: VueTemplateNode): boolean {
  if (isVueBindDirective(prop, 'open')) return false
  if (isDirective(prop, 'on')) return false
  if (isDirective(prop, 'model')) return false
  return true
}

/** The names the overlay's drawn content reads: its own bindings and everything inside it. */
function contentNames(element: VueTemplateNode): Set<string> {
  const names = new Set<string>()
  if (!('props' in element) || !('children' in element)) return names
  const visit = (node: VueTemplateNode) => {
    if (node.type === VUE_DIRECTIVE_NODE && isDirective(node, 'on')) return
    walkVueTemplateAst(node, (inner) => {
      if (inner.type === VUE_DIRECTIVE_NODE && !isDirective(inner, 'on')) {
        for (const name of expressionNames(inner.exp)) names.add(name)
      }
      if (inner.type === VUE_INTERPOLATION_NODE) {
        for (const name of expressionNames(inner.content)) names.add(name)
      }
    })
  }
  for (const prop of element.props) if (drawsContent(prop)) visit(prop)
  for (const child of element.children) {
    if (typeof child !== 'string' && typeof child !== 'symbol') visit(child)
  }
  return names
}

const HELD_CONTENT = '`useHeldContent` from `@/components/ui/overlay/held`'

/**
 * Overlays that close at once rather than animating out (`motionStyles.floating` in
 * `src/theme/motion/styles.ts`), so nothing is drawn after their state clears.
 */
const INSTANT_CLOSE_ROOTS = new Set([
  'PopoverRoot',
  'TooltipRoot',
  'HoverCardRoot',
  'DropdownMenuRoot',
  'ContextMenuRoot',
  'MenubarRoot',
  'SelectRoot',
  'ComboboxRoot',
  'AppPicker',
  'AppSelect',
  'AppCombobox'
])

const noOverlayContentFromOpenState = {
  meta: {
    docs: {
      description:
        'Disallow overlays that draw the state deciding their `open` — closing would redraw cleared content'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!isVueSourceFile(file)) return {}

    return {
      Program(node) {
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        walkVueTemplateAst(template, (element) => {
          if (element.type !== VUE_ELEMENT_NODE || INSTANT_CLOSE_ROOTS.has(element.tag)) return
          const open = element.props.find((prop) => isVueBindDirective(prop, 'open'))
          if (!open || open.type !== VUE_DIRECTIVE_NODE) return
          if (open.exp?.type === VUE_SIMPLE_EXPRESSION_NODE && open.exp.content.trim() === 'true') {
            if (element.props.some((prop) => isDirective(prop, 'if'))) {
              context.report({
                node,
                message: `<${element.tag}> opens through v-if, so clearing it removes the overlay without its closing animation. Bind :open to the state and draw the content from ${HELD_CONTENT}.`
              })
            }
            return
          }
          const deciding = openStateNames(open.exp)
          const drawn = contentNames(element)
          const shared = [...deciding].filter((name) => drawn.has(name))
          if (shared.length === 0) return
          context.report({
            node,
            message: `<${element.tag}> draws ${shared.map((name) => `\`${name}\``).join(', ')}, which also decides :open; clearing it to close redraws the overlay while it animates out. Draw the content from ${HELD_CONTENT}.`
          })
        })
      }
    }
  }
} satisfies RuleDefinition

export { noOverlayContentFromOpenState }
