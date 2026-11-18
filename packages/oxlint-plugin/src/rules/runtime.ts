import { isTestFile, normalizedFilename } from '#oxlint-plugin/support/context'
import { defineRule } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'

const noMathRandom = defineRule({
  meta: {
    docs: {
      description: 'Disallow Math.random() — use crypto.getRandomValues() instead'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Math' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'random'
        ) {
          context.report({
            node,
            message: 'Use crypto.getRandomValues() instead of Math.random().'
          })
        }
      }
    }
  }
})

const noSilentCatch = defineRule({
  meta: {
    docs: {
      description:
        'Disallow empty catch blocks — log a warning or re-throw instead of silently swallowing errors'
    }
  },
  create(context) {
    return {
      CatchClause(node) {
        const statements = node.body.body.filter((statement) => statement.type !== 'EmptyStatement')
        if (statements.length > 0) return
        context.report({
          node,
          message:
            'Empty catch block silently swallows errors. Add console.warn(), re-throw, or an explicit // oxlint-ignore-next-line comment.'
        })
      }
    }
  }
})

const noReflectDeleteGlobalThisOutsideTests = defineRule({
  meta: {
    docs: {
      description: 'Disallow Reflect.deleteProperty(globalThis, ...) outside tests'
    }
  },
  create(context) {
    if (isTestFile(normalizedFilename(context))) return {}

    return {
      CallExpression(node) {
        const { callee } = node
        if (callee.type !== 'MemberExpression') return
        if (callee.object.type !== 'Identifier' || callee.object.name !== 'Reflect') return
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'deleteProperty')
          return
        const [first] = node.arguments
        if (first?.type !== 'Identifier' || first.name !== 'globalThis') return
        context.report({
          node,
          message:
            'Do not mutate globalThis outside tests; isolate platform state behind a boundary.'
        })
      }
    }
  }
})

const noConditionalObjectSpreads = defineRule({
  meta: {
    docs: {
      description: 'Require explicit branches instead of complex conditional object spreads'
    }
  },
  create(context) {
    return {
      SpreadElement(node) {
        const { parent } = node
        if (parent.type !== 'ObjectExpression') return
        if (node.argument.type !== 'ConditionalExpression') return
        const branchSizes = [node.argument.consequent, node.argument.alternate]
          .filter((branch) => branch.type === 'ObjectExpression')
          .map((branch) => branch.properties.length)
        const conditionalSpreadCount = parent.properties.filter(
          (property) =>
            property.type === 'SpreadElement' && property.argument.type === 'ConditionalExpression'
        ).length
        if (conditionalSpreadCount < 2 && branchSizes.every((size) => size < 2)) return
        context.report({
          node,
          message:
            'Extract conditional object construction into an explicit branch or named domain projection.'
        })
      }
    }
  }
})

/** Timer calls whose delay is a duration: `setTimeout` and `setInterval` take it second. */
const TIMER_DELAY_ARGUMENT: Readonly<Record<string, number>> = { setTimeout: 1, setInterval: 1 }

/** The name a timer call is made by: `setTimeout(...)`, `window.setTimeout(...)`, and the like. */
function timerName(callee: ESTree.Expression | ESTree.Super): string | undefined {
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    return callee.property.name
  }
  return undefined
}

function isNumber(node: ESTree.Node): boolean {
  return node.type === 'Literal' && typeof node.value === 'number'
}

/** A number written in place: `3000`, `30 * 1000`, `-1`. Zero only yields, so it may stay. */
function isWrittenDuration(node: ESTree.Node): boolean {
  if (node.type === 'Literal') return typeof node.value === 'number' && node.value !== 0
  if (node.type === 'UnaryExpression') return isWrittenDuration(node.argument)
  if (node.type === 'BinaryExpression') return isNumber(node.left) && isNumber(node.right)
  return false
}

const noInlineDelay = defineRule({
  meta: {
    docs: {
      description:
        'Disallow a duration written in place as a timer delay or AbortSignal.timeout — name it'
    }
  },
  create(context) {
    // A test's waits only order steps, and say so where they stand.
    if (isTestFile(normalizedFilename(context))) return {}
    return {
      CallExpression(node) {
        const { callee } = node
        let duration: (typeof node.arguments)[number] | undefined
        const name = timerName(callee)
        const delayAt = name === undefined ? undefined : TIMER_DELAY_ARGUMENT[name]
        if (delayAt !== undefined) duration = node.arguments[delayAt]
        else if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'AbortSignal' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'timeout'
        ) {
          duration = node.arguments[0]
        }
        if (!duration || !isWrittenDuration(duration)) return
        context.report({
          node: duration,
          message:
            'Name this duration: a constant that says what it bounds and why it is this long, or a shared one.'
        })
      }
    }
  }
})

export {
  noConditionalObjectSpreads,
  noInlineDelay,
  noMathRandom,
  noReflectDeleteGlobalThisOutsideTests,
  noSilentCatch
}
