import { inlineImportSource, normalizedFilename } from '#lint/support/context.ts'
import { createImportSourceRule } from '#lint/support/factories.ts'
import type { RuleContext, RuleDefinition } from '#lint/support/types.ts'

function isPackageOrSubpath(source: string, packageName: string): boolean {
  return source === packageName || source.startsWith(`${packageName}/`)
}

const noVueSelfPackageImports = createImportSourceRule({
  description: 'Disallow @open-pencil/vue self-imports inside the Vue SDK — use #vue/* aliases',
  applies: (file) => file.includes('/packages/vue/src/'),
  check: (source) =>
    isPackageOrSubpath(source, '@open-pencil/vue') &&
    `Use #vue/* for internal Vue SDK imports instead of self-package import '${source}'.`
})

const noCrossPackageSourceImports = createImportSourceRule({
  description:
    'Disallow imports that reach into another workspace package source tree — use package exports or package-local aliases',
  check: (source) =>
    (source.includes('/packages/') ||
      /^(?:\.\.\/){2,}packages\//.test(source) ||
      /^(?:\.\.\/)+(?:core|vue|cli|mcp)\/src\//.test(source)) &&
    `Use workspace package exports or package-local aliases instead of cross-package source import '${source}'.`
})

const noCoreSelfPackageImports = createImportSourceRule({
  description: 'Disallow @open-pencil/core self-imports inside packages/core/src',
  applies: (file) => file.includes('/packages/core/src/'),
  check: (source) =>
    isPackageOrSubpath(source, '@open-pencil/core') &&
    'Core internals must import local modules directly instead of importing the @open-pencil/core public package entrypoints.'
})

const noInlinePromptConstants = {
  meta: {
    docs: {
      description: 'Disallow inline prompt/context template literals — use markdown prompt files'
    }
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (node.id?.type !== 'Identifier') return
        if (!/(?:PROMPT|CONTEXT)/.test(node.id.name)) return
        if (node.init?.type !== 'TemplateLiteral') return
        context.report({
          node,
          message:
            'Move prompt/context text to a dedicated markdown file and import it instead of using an inline template literal.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noAppImportsInPackages = createImportSourceRule({
  description: 'Disallow app-shell imports from workspace packages',
  applies: (file) => file.includes('/packages/'),
  check: (source) =>
    source.startsWith('@/') && `Workspace packages must not import app-shell alias '${source}'.`
})

const frameworkImportPrefixes = ['@vue/', '@tauri-apps/', '@/']

const noCoreFrameworkImports = createImportSourceRule({
  description: 'Keep @open-pencil/core framework-agnostic by disallowing Vue/Tauri/app imports',
  applies: (file) => file.includes('/packages/core/src/'),
  check: (source) =>
    (source === 'vue' ||
      isPackageOrSubpath(source, '@open-pencil/vue') ||
      frameworkImportPrefixes.some((prefix) => source.startsWith(prefix))) &&
    `@open-pencil/core must stay framework-agnostic; do not import '${source}'.`
})

/**
 * Tauri's modules reach the native side only when one of their functions is called, so shipped
 * code imports them statically like any other module. Only the startup support gate loads them
 * inline: it must parse on engines that cannot run the app, which `src/main.ts` keeps free of the
 * app bundle. Tests and tooling, which load Tauri's mocks and CLI in a set order, are not shipped.
 */
const noInlineTauriImports: RuleDefinition = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Import Tauri modules statically, outside the startup support gate' },
    schema: []
  },
  create(context: RuleContext) {
    const file = normalizedFilename(context)
    if (!file.includes('/src/') || /\/(tools|tests)\//.test(file)) return {}
    if (/\/src\/app\/shell\/support\/(gate|render)\.ts$/.test(file)) return {}
    return {
      ImportExpression(node) {
        const source = inlineImportSource(node)
        if (!source?.startsWith('@tauri-apps/')) return
        context.report({
          node,
          message: `Import '${source}' statically; Tauri's modules reach the native side only when called.`
        })
      }
    }
  }
}

/**
 * An edit records what it changed through `recordEdit` or `recordEditAsync`, which push its undo
 * step when the document's unsaved state expects it; capturing a change by hand elsewhere is how
 * an edit's step came to land after an await and left undone documents unsaved.
 */
const noDocumentChangeCapture: RuleDefinition = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow captureDocumentChange outside core editor history — record edits with recordEdit or recordEditAsync'
    },
    schema: []
  },
  create(context: RuleContext) {
    const file = normalizedFilename(context)
    // The history module owns the capture, and its tests exercise it directly.
    if (!file.includes('/src/') || file.includes('/packages/core/src/editor/history/')) return {}
    return {
      ImportSpecifier(node) {
        const imported =
          node.imported.type === 'Identifier' ? node.imported.name : node.imported.value
        if (imported !== 'captureDocumentChange') return
        context.report({
          node,
          message:
            'Record the edit with recordEdit or recordEditAsync instead of capturing a document change by hand.'
        })
      }
    }
  }
}

export {
  noDocumentChangeCapture,
  noVueSelfPackageImports,
  noCrossPackageSourceImports,
  noCoreSelfPackageImports,
  noInlinePromptConstants,
  noAppImportsInPackages,
  noCoreFrameworkImports,
  noInlineTauriImports
}
