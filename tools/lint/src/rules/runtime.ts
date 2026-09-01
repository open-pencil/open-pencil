import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import type { TSESTree } from '@typescript-eslint/utils'

function isUnknownTypeAnnotation(typeAnnotation: unknown): boolean {
  return (
    typeAnnotation !== null &&
    typeof typeAnnotation === 'object' &&
    'type' in typeAnnotation &&
    typeAnnotation.type === 'TSUnknownKeyword'
  )
}

const noDirectStorageAccess = {
  meta: {
    docs: {
      description:
        'Disallow direct localStorage/sessionStorage access outside dedicated storage modules'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const allowedFiles = [
      '/src/app/ai/chat/storage.ts',
      '/src/app/cache/index.ts',
      '/src/app/settings/credentials/storage.ts',
      '/src/app/shell/layout-storage.ts',
      '/packages/vue/src/i18n/locale.ts'
    ]
    if (allowedFiles.some((suffix) => file.endsWith(suffix))) return {}

    function reportStorage(node: TSESTree.Identifier, name: string) {
      context.report({
        node,
        message: `Use a dedicated storage module instead of direct ${name} access.`
      })
    }

    return {
      Identifier(node) {
        if (node.name !== 'localStorage' && node.name !== 'sessionStorage') return
        reportStorage(node, node.name)
      }
    }
  }
} satisfies RuleDefinition

function nestedAsType(node: { expression: unknown }): unknown {
  const expression = node.expression
  return expression && typeof expression === 'object' && 'typeAnnotation' in expression
    ? expression.typeAnnotation
    : null
}

const noBroadDoubleCast = {
  meta: {
    docs: {
      description: 'Disallow broad `as unknown as` casts outside vendored code'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.includes('/packages/core/src/kiwi/kiwi-schema/')) return {}

    return {
      TSAsExpression(node) {
        if (isUnknownTypeAnnotation(nestedAsType(node))) {
          context.report({
            node,
            message: 'Avoid `as unknown as ...`; model the value with a precise type or helper.'
          })
        }
      }
    }
  }
} satisfies RuleDefinition

function isRecordStringUnknownType(typeAnnotation: TSESTree.TypeNode): boolean {
  if (typeAnnotation?.type !== 'TSTypeReference') return false
  if (typeAnnotation.typeName?.type !== 'Identifier' || typeAnnotation.typeName.name !== 'Record') {
    return false
  }
  const parameters = typeAnnotation.typeArguments?.params ?? []
  return parameters[0]?.type === 'TSStringKeyword' && parameters[1]?.type === 'TSUnknownKeyword'
}

const noUnknownRecordDoubleCast = {
  meta: {
    docs: {
      description: 'Disallow `as unknown as Record<string, unknown>` broad object casts'
    }
  },
  create(context) {
    return {
      TSAsExpression(node) {
        if (!isUnknownTypeAnnotation(nestedAsType(node))) return
        if (!isRecordStringUnknownType(node.typeAnnotation)) return
        context.report({
          node,
          message:
            'Avoid `as unknown as Record<string, unknown>`; use a precise type or direct public API.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noFunctionType = {
  meta: {
    docs: {
      description: 'Disallow the broad Function type; use an explicit callable signature'
    }
  },
  create(context) {
    return {
      TSTypeReference(node) {
        if (node.typeName?.type !== 'Identifier' || node.typeName.name !== 'Function') return
        context.report({
          node,
          message: 'Use an explicit function signature instead of the broad Function type.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noReflectDeleteGlobalThisOutsideTests = {
  meta: {
    docs: {
      description: 'Disallow Reflect.deleteProperty(globalThis, ...) outside tests'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.includes('/tests/')) return {}

    return {
      CallExpression(node) {
        if (node.callee?.type !== 'MemberExpression') return
        if (node.callee.object?.type !== 'Identifier' || node.callee.object.name !== 'Reflect')
          return
        if (
          node.callee.property?.type !== 'Identifier' ||
          node.callee.property.name !== 'deleteProperty'
        )
          return
        const firstArg = node.arguments?.[0]
        if (firstArg?.type !== 'Identifier' || firstArg.name !== 'globalThis') return
        context.report({
          node,
          message:
            'Do not mutate globalThis outside tests; isolate platform state behind a boundary.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noTsSuppressionComments = {
  meta: {
    docs: {
      description: 'Disallow TypeScript suppression comments; fix types instead'
    }
  },
  create(context) {
    return {
      Program() {
        const comments = context.sourceCode.getAllComments?.() ?? []
        for (const comment of comments) {
          if (!/@ts-(?:ignore|expect-error|nocheck|check)\b/.test(comment.value)) continue
          context.report({
            node: comment,
            message:
              'Do not use TypeScript suppression comments; fix the type or add a typed helper.'
          })
        }
      }
    }
  }
} satisfies RuleDefinition

const noCoreBrowserGlobals = {
  meta: {
    docs: {
      description:
        'Disallow direct browser globals in core outside explicit platform boundary modules'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/packages/core/src/')) return {}

    const allowedFiles = [
      '/packages/core/src/constants.ts',
      '/packages/core/src/editor/create.ts',
      '/packages/core/src/canvas/renderer.ts',
      '/packages/core/src/text/fonts.ts',
      '/packages/core/src/profiler/render-profiler.ts',
      '/packages/core/src/figma-api/index.ts'
    ]
    if (allowedFiles.some((suffix) => file.endsWith(suffix))) return {}

    return {
      Identifier(node) {
        if (node.name !== 'window' && node.name !== 'document' && node.name !== 'navigator') return
        context.report({
          node,
          message: `Do not use browser global '${node.name}' in core; route it through a platform boundary.`
        })
      }
    }
  }
} satisfies RuleDefinition

const noDirectGraphEmitterSubscriptions = {
  meta: {
    docs: {
      description: 'Disallow direct graph.emitter.on subscriptions outside SceneGraph helpers'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.endsWith('/packages/core/src/scene-graph/index.ts')) return {}

    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee?.type !== 'MemberExpression') return
        if (callee.property?.type !== 'Identifier' || callee.property.name !== 'on') return
        const object = callee.object
        if (object?.type !== 'MemberExpression') return
        if (object.property?.type !== 'Identifier' || object.property.name !== 'emitter') return
        context.report({
          node,
          message: 'Use SceneGraph.onNodeEvents() instead of subscribing to graph.emitter directly.'
        })
      }
    }
  }
} satisfies RuleDefinition

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
  noDirectStorageAccess,
  noBroadDoubleCast,
  noUnknownRecordDoubleCast,
  noFunctionType,
  noReflectDeleteGlobalThisOutsideTests,
  noTsSuppressionComments,
  noCoreBrowserGlobals,
  noDirectGraphEmitterSubscriptions,
  noOnUnmountedInCompositionRoots,
  noComposableStateWrappers,
  preferVueUseIntervals,
  preferVueUseTimeouts,
  maxCompositionRootLines
}
