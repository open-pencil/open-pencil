import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import type { TSESTree } from '@typescript-eslint/utils'

const noOnUnmountedInCompositionRoots = {
  meta: {
    docs: {
      description: 'Prefer tryOnScopeDispose over onUnmounted in composable roots'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const applies =
      (file.includes('/src/app/') || file.includes('/packages/vue/src/')) &&
      /\/(?:use|create)\.ts$/.test(file)
    if (!applies) return {}

    return {
      CallExpression(node) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'onUnmounted') return
        context.report({
          node,
          message:
            'Use tryOnScopeDispose() for composable cleanup so callers outside component setup are handled safely.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noComposableStateWrappers = {
  meta: {
    docs: {
      description: 'Disallow create*ComposableState wrapper factories in app and Vue SDK code'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const applies = file.includes('/src/app/') || file.includes('/packages/vue/src/')
    if (!applies) return {}

    return {
      FunctionDeclaration(node) {
        if (!node.id?.name || !/^create\w*ComposableState$/.test(node.id.name)) return
        context.report({
          node,
          message:
            'Avoid wrapper-of-wrapper composable state factories; keep setup local or extract a cohesive domain helper.'
        })
      }
    }
  }
} satisfies RuleDefinition

const preferVueUseIntervals = {
  meta: {
    docs: {
      description: 'Prefer VueUse interval helpers over manual setInterval/clearInterval pairs'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const applies = file.includes('/src/app/') || file.includes('/packages/vue/src/')
    if (!applies) return {}

    function intervalName(callee: TSESTree.Expression): string | null {
      if (callee?.type === 'Identifier') return callee.name
      if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
        return callee.property.name
      }
      return null
    }

    return {
      CallExpression(node) {
        const name = intervalName(node.callee)
        if (name !== 'setInterval' && name !== 'clearInterval') return
        context.report({
          node,
          message: 'Use useIntervalFn() from @vueuse/core instead of manual interval cleanup.'
        })
      }
    }
  }
} satisfies RuleDefinition

const preferVueUseTimeouts = {
  meta: {
    docs: {
      description: 'Prefer VueUse timeout helpers over manual timeout cleanup in composables'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const applies =
      ((file.includes('/src/app/') || file.includes('/packages/vue/src/')) &&
        /\/(?:use|create)\.ts$/.test(file)) ||
      file.endsWith('/src/app/shell/toast/action.ts')
    if (!applies) return {}

    return {
      CallExpression(node) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'clearTimeout') return
        context.report({
          node,
          message:
            'Use useTimeoutFn() from @vueuse/core instead of manual timeout cleanup in composables.'
        })
      }
    }
  }
} satisfies RuleDefinition

const maxCompositionRootLines = {
  meta: {
    docs: {
      description:
        'Keep composition roots small; extract domain helpers before they become cleanup projects'
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { type: 'number' }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const file = normalizedFilename(context)
    const applies =
      (file.includes('/src/app/') || file.includes('/packages/vue/src/')) &&
      /\/(?:use|create)\.ts$/.test(file)
    if (!applies) return {}

    const options = context.options[0]
    const max =
      options && typeof options === 'object' && 'max' in options && typeof options.max === 'number'
        ? options.max
        : 260

    return {
      Program(node) {
        const source = context.sourceCode.getText()
        const normalized = source.endsWith('\n') ? source.slice(0, -1) : source
        const lineCount = normalized.split('\n').length
        if (lineCount <= max) return
        context.report({
          node,
          message: `Composition root is ${lineCount} lines; extract helpers before exceeding ${max} lines.`
        })
      }
    }
  }
} satisfies RuleDefinition

export {
  noOnUnmountedInCompositionRoots,
  noComposableStateWrappers,
  preferVueUseIntervals,
  preferVueUseTimeouts,
  maxCompositionRootLines
}
