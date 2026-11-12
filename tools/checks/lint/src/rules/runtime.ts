import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import type { TSESTree } from '@typescript-eslint/utils'

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
      '/src/app/document/recovery/session/storage.ts',
      '/src/app/settings/credentials/storage.ts',
      '/src/app/settings/theme.ts',
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
        const parent = node.parent
        if (parent.type === 'Property' && parent.key === node && !parent.computed) return
        reportStorage(node, node.name)
      }
    }
  }
} satisfies RuleDefinition

const noViteHotOutsideReload = {
  meta: {
    docs: {
      description: 'Disallow import.meta.hot outside the module that announces development reloads'
    }
  },
  create(context) {
    if (normalizedFilename(context).endsWith('/src/app/shell/reload/vite.ts')) return {}
    return {
      MetaProperty(node) {
        const parent = node.parent
        if (
          parent.type !== 'MemberExpression' ||
          parent.object !== node ||
          parent.computed ||
          parent.property.type !== 'Identifier' ||
          parent.property.name !== 'hot'
        ) {
          return
        }
        context.report({
          node: parent,
          message:
            'Register reload work with onBeforeReload from @/app/shell/reload; only src/app/shell/reload/vite.ts reads import.meta.hot.'
        })
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
      '/packages/core/src/text/font/manager.ts',
      '/packages/core/src/text/font/local.ts',
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

const noBunGlobalsInCli = {
  meta: { docs: { description: 'Disallow Bun globals in Node-compatible CLI source' } },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/packages/cli/src/')) return {}
    return {
      MemberExpression(node) {
        if (node.object?.type !== 'Identifier' || node.object.name !== 'Bun') return
        context.report({
          node,
          message: 'Use Node-compatible APIs in CLI source instead of Bun globals.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noRawConsoleFormat = {
  meta: {
    docs: {
      description:
        'Disallow hand-rolled formatting in console.log — use agentfmt helpers (bold, dim, kv, entity, fmtTree, fmtList, etc.)'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee?.type !== 'MemberExpression' ||
          node.callee.object?.type !== 'Identifier' ||
          node.callee.object.name !== 'console' ||
          node.callee.property?.type !== 'Identifier' ||
          node.callee.property.name !== 'log'
        )
          return
        if (!node.arguments?.length) return

        for (const arg of node.arguments) {
          if (arg.type === 'TemplateLiteral' && arg.expressions?.length > 0) {
            context.report({
              node,
              message:
                'Use agentfmt helpers (bold, dim, kv, entity, etc.) instead of template literals in console.log.'
            })
            return
          }
          if (arg.type === 'BinaryExpression' && arg.operator === '+') {
            context.report({
              node,
              message:
                'Use agentfmt helpers (bold, dim, kv, entity, etc.) instead of string concatenation in console.log.'
            })
            return
          }
        }
      }
    }
  }
} satisfies RuleDefinition

const noTypeofWindowCheck = {
  meta: {
    docs: {
      description: 'Disallow raw typeof window checks — use IS_BROWSER or IS_TAURI from constants'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.endsWith('constants.ts')) return {}

    return {
      BinaryExpression(node) {
        if (node.operator !== '!==' && node.operator !== '===') return
        const isTypeofWindow = (side: TSESTree.Expression) =>
          side.type === 'UnaryExpression' &&
          side.operator === 'typeof' &&
          side.argument?.type === 'Identifier' &&
          side.argument.name === 'window'
        if (isTypeofWindow(node.left) || isTypeofWindow(node.right)) {
          context.report({
            node,
            message:
              "Use IS_BROWSER or IS_TAURI from constants instead of raw 'typeof window' checks."
          })
        }
      }
    }
  }
} satisfies RuleDefinition

export {
  noDirectStorageAccess,
  noViteHotOutsideReload,
  noCoreBrowserGlobals,
  noBunGlobalsInCli,
  noRawConsoleFormat,
  noTypeofWindowCheck
}
