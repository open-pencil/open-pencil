import type { TSESTree } from '@typescript-eslint/utils'

import { normalizedFilename, staticPropertyName } from '../../support/context.ts'
import type { RuleDefinition } from '../../support/types.ts'

const noBrowserSideEffectsInVue = {
  meta: {
    docs: {
      description:
        'Disallow direct browser side effects in Vue components — use VueUse, refs, or app services'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue')) return {}

    function objectName(object: TSESTree.Expression): string | null {
      return object?.type === 'Identifier' ? object.name : null
    }

    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee?.type !== 'MemberExpression') return
        const object = objectName(callee.object)
        const property = staticPropertyName(callee.property)

        if (
          (object === 'window' || object === 'document') &&
          (property === 'addEventListener' || property === 'removeEventListener')
        ) {
          context.report({
            node,
            message:
              'Use VueUse useEventListener() instead of direct browser event listeners in Vue components.'
          })
          return
        }

        if (object === 'document' && property === 'createElement') {
          context.report({
            node,
            message:
              'Do not create DOM elements directly in Vue components. Use template refs, components, or an app service.'
          })
        }
      },
      MemberExpression(node) {
        const directStorage = objectName(node.object)
        let globalStorage: string | null = null
        if (
          node.object.type === 'MemberExpression' &&
          (objectName(node.object.object) === 'window' ||
            objectName(node.object.object) === 'globalThis')
        ) {
          globalStorage = staticPropertyName(node.object.property)
        }
        const storage = directStorage ?? globalStorage
        if (storage !== 'localStorage' && storage !== 'sessionStorage') return
        context.report({
          node,
          message:
            'Do not access localStorage/sessionStorage directly in Vue components. Use VueUse storage helpers or an app service.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noDocumentQuerySelectorInVue = {
  meta: {
    docs: {
      description:
        'Disallow document.querySelector in Vue components — use template refs or composables'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue')) return {}

    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee?.type !== 'MemberExpression') return
        if (callee.object?.type !== 'Identifier' || callee.object.name !== 'document') return
        if (callee.property?.type !== 'Identifier') return
        if (
          callee.property.name !== 'querySelector' &&
          callee.property.name !== 'querySelectorAll'
        ) {
          return
        }
        context.report({
          node,
          message:
            'Do not query the document from Vue components. Use template refs, component APIs, or a composable.'
        })
      }
    }
  }
} satisfies RuleDefinition

export { noBrowserSideEffectsInVue, noDocumentQuerySelectorInVue }
