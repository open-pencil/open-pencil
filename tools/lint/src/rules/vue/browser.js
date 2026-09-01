import { normalizedFilename } from '../../support/context.js'

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

    function propertyName(property) {
      if (property?.type === 'Identifier') return property.name
      if (property?.type === 'Literal' && typeof property.value === 'string') return property.value
      return null
    }

    function objectName(object) {
      return object?.type === 'Identifier' ? object.name : null
    }

    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee?.type !== 'MemberExpression') return
        const object = objectName(callee.object)
        const property = propertyName(callee.property)

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
        const object = objectName(node.object)
        if (object !== 'localStorage' && object !== 'sessionStorage') return
        context.report({
          node,
          message:
            'Do not access localStorage/sessionStorage directly in Vue components. Use VueUse storage helpers or an app service.'
        })
      }
    }
  }
}

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
}

export { noBrowserSideEffectsInVue, noDocumentQuerySelectorInVue }
