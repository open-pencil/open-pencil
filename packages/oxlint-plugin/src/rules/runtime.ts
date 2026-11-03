import { isTestFile, normalizedFilename } from '#oxlint-plugin/support/context'
import { defineRule } from '@oxlint/plugins'

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

export {
  noConditionalObjectSpreads,
  noMathRandom,
  noReflectDeleteGlobalThisOutsideTests,
  noSilentCatch
}
