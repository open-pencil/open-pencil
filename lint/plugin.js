import { existsSync } from 'node:fs'

function normalizedFilename(context) {
  return (context.filename ?? context.getFilename?.() ?? '').replace(/\\/g, '/')
}

function importSource(node) {
  return typeof node.source?.value === 'string' ? node.source.value : null
}

function createProgramFilenameRule({ description, check }) {
  return {
    meta: {
      docs: { description }
    },
    create(context) {
      const file = normalizedFilename(context)
      const message = check(file)
      if (!message) return {}

      return {
        Program(node) {
          context.report({ node, message })
        }
      }
    }
  }
}

function createImportSourceRule({
  description,
  applies = () => true,
  includeExports = false,
  includeDynamic = false,
  check
}) {
  return {
    meta: {
      docs: { description }
    },
    create(context) {
      const file = normalizedFilename(context)
      if (!applies(file)) return {}

      function reportIfRestricted(node) {
        const source = importSource(node)
        if (!source) return
        const message = check(source, file)
        if (!message) return
        context.report({ node, message })
      }

      const visitors = { ImportDeclaration: reportIfRestricted }
      if (includeExports) {
        visitors.ExportAllDeclaration = reportIfRestricted
        visitors.ExportNamedDeclaration = reportIfRestricted
      }
      if (includeDynamic) visitors.ImportExpression = reportIfRestricted
      return visitors
    }
  }
}

function isUnknownTypeAnnotation(typeAnnotation) {
  return typeAnnotation?.type === 'TSUnknownKeyword'
}

const noInlineNamedTypes = {
  meta: {
    docs: {
      description: 'Disallow inline type literals that duplicate a named type'
    },
    schema: [
      {
        type: 'object',
        additionalProperties: {
          type: 'string'
        }
      }
    ]
  },
  create(context) {
    const typesOption = context.options[0]
    if (!typesOption || typeof typesOption !== 'object') return {}

    const shapeToName = new Map()
    for (const [name, shape] of Object.entries(typesOption)) {
      shapeToName.set(shape, name)
    }

    return {
      TSTypeLiteral(node) {
        const props = node.members?.filter(
          (m) => m.type === 'TSPropertySignature' && m.key?.type === 'Identifier'
        )
        if (!props || props.length < 2) return

        const required = props.filter((m) => !m.optional)
        if (required.length < 2) return

        const shape = required
          .map((m) => {
            const typeNode = m.typeAnnotation?.typeAnnotation
            let typeName = 'unknown'
            if (typeNode) {
              switch (typeNode.type) {
                case 'TSNumberKeyword':
                  typeName = 'number'
                  break
                case 'TSStringKeyword':
                  typeName = 'string'
                  break
                case 'TSBooleanKeyword':
                  typeName = 'boolean'
                  break
              }
            }
            return `${m.key.name}:${typeName}`
          })
          .sort()
          .join(',')

        const namedType = shapeToName.get(shape)
        if (namedType) {
          context.report({
            node,
            message: `Use '${namedType}' instead of inline type literal. Import from '@open-pencil/core'.`
          })
        }
      }
    }
  }
}

const noStructuredCloneSceneArrays = {
  meta: {
    docs: {
      description:
        'Disallow structuredClone on fills/strokes/effects — use typed copy helpers from copy.ts'
    },
    schema: [
      {
        type: 'array',
        items: { type: 'string' },
        description: 'Property names that should use typed copy helpers'
      }
    ]
  },
  create(context) {
    const props = new Set(
      context.options[0] ?? [
        'fills',
        'strokes',
        'effects',
        'styleRuns',
        'fillGeometry',
        'strokeGeometry'
      ]
    )
    return {
      CallExpression(node) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'structuredClone') return
        if (node.arguments?.length !== 1) return
        const arg = node.arguments[0]
        if (arg.type === 'MemberExpression' && arg.property?.type === 'Identifier') {
          if (props.has(arg.property.name)) {
            context.report({
              node,
              message: `Use the typed copy helper instead of structuredClone for '${arg.property.name}'. Import from '@open-pencil/core'.`
            })
          }
        }
      }
    }
  }
}

const noVueStyleBlocks = {
  meta: {
    docs: {
      description: 'Disallow Vue component <style> blocks — use Tailwind utilities or global tokens'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue')) return {}
    if (!file.includes('/src/') && !file.includes('/packages/vue/src/')) return {}

    return {
      Program(node) {
        const source = context.sourceCode.getText()
        if (/<style\b/i.test(source)) {
          context.report({
            node,
            message:
              'Vue components must not use <style> blocks. Use Tailwind utilities or global app.css tokens.'
          })
        }
      }
    }
  }
}

const TEST_ID_FORMAT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

const noRawTestIdStringProps = {
  meta: {
    docs: {
      description: 'Disallow raw testId string props — use TestIdProps or RequiredTestIdProps'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.endsWith('/packages/vue/src/testing/test-id.ts')) return {}

    function isTestIdKey(key) {
      return key?.type === 'Identifier' && key.name === 'testId'
    }

    function isStringType(member) {
      return member.typeAnnotation?.typeAnnotation?.type === 'TSStringKeyword'
    }

    function report(node, optional) {
      context.report({
        node,
        message: optional
          ? 'Use TestIdProps instead of declaring testId?: string directly.'
          : 'Use RequiredTestIdProps or TestId instead of declaring testId: string directly.'
      })
    }

    return {
      TSPropertySignature(node) {
        if (!isTestIdKey(node.key) || !isStringType(node)) return
        report(node, !!node.optional)
      }
    }
  }
}

const noDynamicDataTestIdInVue = {
  meta: {
    docs: {
      description: 'Disallow dynamic :data-test-id in Vue components — use v-test-id'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue')) return {}

    return {
      Program(node) {
        const source = context.sourceCode.getText()
        if (/\B:data-test-id\s*=|\bv-bind:data-test-id\s*=/.test(source)) {
          context.report({
            node,
            message: 'Use v-test-id for dynamic/configurable test ids instead of :data-test-id.'
          })
        }
      }
    }
  }
}

const noTestIdHelperBindInVue = {
  meta: {
    docs: {
      description: 'Prefer v-test-id over v-bind="testId(...)" in Vue templates'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue')) return {}

    return {
      Program(node) {
        const source = context.sourceCode.getText()
        if (/\bv-bind\s*=\s*"testId(?:Attr)?\(/.test(source)) {
          context.report({
            node,
            message: 'Use v-test-id instead of v-bind="testId(...)" in Vue templates.'
          })
        }
      }
    }
  }
}

const noInvalidTestIdAttributes = {
  meta: {
    docs: {
      description: 'Enforce data-test-id spelling and kebab-case static test ids in Vue components'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue')) return {}

    return {
      Program(node) {
        const source = context.sourceCode.getText()
        const invalidAttr = source.match(/\bdata-testid\s*=/)
        if (invalidAttr) {
          context.report({
            node,
            message: 'Use data-test-id instead of data-testid.'
          })
          return
        }

        const attrPattern = /\bdata-test-id\s*=\s*"([^"]+)"/g
        for (const match of source.matchAll(attrPattern)) {
          const id = match[1]
          if (TEST_ID_FORMAT.test(id)) continue
          context.report({
            node,
            message: `Static data-test-id values must be kebab-case. Invalid id: "${id}".`
          })
          return
        }
      }
    }
  }
}

const noGeneratedTestIdLiterals = {
  meta: {
    docs: {
      description: 'Disallow hand-written generated test-id literals — use shared helper functions'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.endsWith('/packages/vue/src/testing/test-id.ts')) return {}
    if (file.endsWith('/tests/helpers/test-ids.ts')) return {}
    if (!file.includes('/src/') && !file.includes('/tests/')) return {}

    return {
      Program(node) {
        const source = context.sourceCode.getText()
        const match = source.match(
          /["'`](?:mobile-)?toolbar-(?:tool|flyout|flyout-item)-|["'`]variables-add-(?:float|string|boolean)["'`]|["'`]acp-permission-option-/
        )
        if (!match) return
        context.report({
          node,
          message:
            'Use shared generated test-id helpers instead of hand-written toolbar/variable/permission id literals.'
        })
      }
    }
  }
}

const noDocumentQuerySelectorInVue = {
  meta: {
    docs: {
      description: 'Disallow document.querySelector in Vue components — use template refs or composables'
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
        if (callee.property.name !== 'querySelector' && callee.property.name !== 'querySelectorAll') {
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

const noDirectSelectionToolStateMutation = {
  meta: {
    docs: {
      description: 'Disallow direct editor selection/tool state assignment outside core editor internals'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.includes('/packages/core/src/editor/')) return {}

    return {
      AssignmentExpression(node) {
        if (node.operator !== '=') return
        const left = node.left
        if (left?.type !== 'MemberExpression') return
        if (left.property?.type !== 'Identifier') return
        if (left.property.name !== 'selectedIds' && left.property.name !== 'activeTool') return
        const stateExpr = left.object
        if (stateExpr?.type !== 'MemberExpression') return
        if (stateExpr.property?.type !== 'Identifier' || stateExpr.property.name !== 'state') return
        context.report({
          node,
          message:
            'Do not assign editor.state.selectedIds or editor.state.activeTool directly. Use editor selection/tool actions.'
        })
      }
    }
  }
}

const noMathRandom = {
  meta: {
    docs: {
      description: 'Disallow Math.random() — use crypto.getRandomValues() instead'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee?.type === 'MemberExpression' &&
          node.callee.object?.type === 'Identifier' &&
          node.callee.object.name === 'Math' &&
          node.callee.property?.type === 'Identifier' &&
          node.callee.property.name === 'random'
        ) {
          context.report({
            node,
            message: 'Use crypto.getRandomValues() instead of Math.random().'
          })
        }
      }
    }
  }
}

const noHandRolledColor = {
  meta: {
    docs: {
      description:
        'Disallow hand-rolled color conversions — use helpers from color.ts (colorToCSS, colorToHex, parseColor, etc.)'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.includes('/color') && /(?:color\.ts|color\/index\.ts)$/.test(file)) return {}

    return {
      TemplateLiteral(node) {
        const raw = context.sourceCode.getText(node)
        if (/rgba?\s*\(/.test(raw)) {
          context.report({
            node,
            message:
              'Use colorToCSS() or colorToHex() from color.ts instead of hand-rolled rgba()/rgb() strings.'
          })
        }
      }
    }
  }
}

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
}

const noSilentCatch = {
  meta: {
    docs: {
      description:
        'Disallow empty catch blocks — log a warning or re-throw instead of silently swallowing errors'
    }
  },
  create(context) {
    return {
      CatchClause(node) {
        const body = node.body
        if (!body || !body.body) return
        const stmts = body.body.filter((s) => s.type !== 'EmptyStatement')
        if (stmts.length === 0) {
          context.report({
            node,
            message:
              'Empty catch block silently swallows errors. Add console.warn(), re-throw, or an explicit // oxlint-ignore-next-line comment.'
          })
        }
      }
    }
  }
}

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
        const isTypeofWindow = (side) =>
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
}

const noVueSelfPackageImports = createImportSourceRule({
  description: 'Disallow @open-pencil/vue self-imports inside the Vue SDK — use #vue/* aliases',
  applies: (file) => file.includes('/packages/vue/src/'),
  check: (source) =>
    source.startsWith('@open-pencil/vue') &&
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

function createParentRelativeImportRule({ description, applies, message, minDepth = 1 }) {
  return {
    meta: {
      docs: { description }
    },
    create(context) {
      const file = normalizedFilename(context)
      if (!applies(file)) return {}

      function reportSource(node, source) {
        if (!source?.startsWith('../')) return
        const depth = source.match(/^(?:\.\.\/)+/)?.[0].split('../').length - 1
        if ((depth ?? 0) < minDepth) return
        if (/^(?:\.\.\/)+package\.json$/.test(source)) return
        context.report({ node, message })
      }

      function reportParentRelative(node) {
        reportSource(node, importSource(node))
      }

      return {
        ExportAllDeclaration: reportParentRelative,
        ExportNamedDeclaration: reportParentRelative,
        ImportDeclaration: reportParentRelative,
        ImportExpression(node) {
          reportSource(node, typeof node.source?.value === 'string' ? node.source.value : null)
        }
      }
    }
  }
}

const noDeepParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow deep parent-relative imports — use package/test aliases instead',
  applies: () => true,
  message: 'Use an import alias instead of path drilling with ../.. imports.',
  minDepth: 2
})

const noCoreParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow parent-relative imports in core internals — use #core/* aliases',
  applies: (file) =>
    file.includes('/packages/core/src/') && !file.includes('/packages/core/src/kiwi/kiwi-schema/'),
  message: 'Use the #core/* package-local alias instead of parent-relative core imports.'
})

const noMcpParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow parent-relative imports in MCP internals — use #mcp/* aliases',
  applies: (file) => file.includes('/packages/mcp/src/'),
  message: 'Use the #mcp/* package-local alias instead of parent-relative MCP imports.'
})

const noVueParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow parent-relative imports in Vue SDK internals — use #vue/* aliases',
  applies: (file) => file.includes('/packages/vue/src/'),
  message: 'Use the #vue/* package-local alias instead of parent-relative Vue SDK imports.'
})

const noCliParentRelativeImports = createParentRelativeImportRule({
  description: 'Disallow parent-relative imports in CLI internals — use #cli/* aliases',
  applies: (file) => file.includes('/packages/cli/src/'),
  message: 'Use the #cli/* package-local alias instead of parent-relative CLI imports.'
})

function createExactCoreBarrelImportRule({ description, applies, message }) {
  return createImportSourceRule({
    description,
    applies,
    check: (source) => source === '@open-pencil/core' && message
  })
}

const noMcpCoreBarrelImports = createExactCoreBarrelImportRule({
  description: 'Disallow MCP imports from @open-pencil/core root barrel — use domain subpaths',
  applies: (file) => file.includes('/packages/mcp/src/'),
  message:
    'Use a targeted @open-pencil/core subpath in MCP code instead of the compatibility barrel.'
})

const noCliCoreBarrelImports = createExactCoreBarrelImportRule({
  description: 'Disallow CLI imports from @open-pencil/core root barrel — use domain subpaths',
  applies: (file) => file.includes('/packages/cli/src/'),
  message:
    'Use a targeted @open-pencil/core subpath in CLI code instead of the compatibility barrel.'
})

const noScriptCoreBarrelImports = createExactCoreBarrelImportRule({
  description: 'Disallow script imports from @open-pencil/core root barrel — use domain subpaths',
  applies: (file) => file.includes('/scripts/'),
  message:
    'Use a targeted @open-pencil/core subpath or #core/* alias in scripts instead of the compatibility barrel.'
})

const noCoreSelfPackageImports = createImportSourceRule({
  description: 'Disallow @open-pencil/core self-imports inside packages/core/src',
  applies: (file) => file.includes('/packages/core/src/'),
  check: (source) =>
    source.startsWith('@open-pencil/core') &&
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
}

const noAppVueCoreBarrelImports = createExactCoreBarrelImportRule({
  description:
    'Disallow app and Vue SDK imports from @open-pencil/core root barrel — use domain subpaths',
  applies: (file) =>
    (file.includes('/src/') && !file.includes('/packages/')) || file.includes('/packages/vue/src/'),
  message:
    'Use a targeted @open-pencil/core subpath (editor, scene-graph, constants, io, etc.) instead of the compatibility barrel.'
})

const noAppImportsInPackages = createImportSourceRule({
  description: 'Disallow app-shell imports from workspace packages',
  applies: (file) => file.includes('/packages/'),
  check: (source) =>
    source.startsWith('@/') && `Workspace packages must not import app-shell alias '${source}'.`
})

const frameworkImportPrefixes = ['@vue/', '@open-pencil/vue', '@tauri-apps/', '@/']

const noCoreFrameworkImports = createImportSourceRule({
  description: 'Keep @open-pencil/core framework-agnostic by disallowing Vue/Tauri/app imports',
  applies: (file) => file.includes('/packages/core/src/'),
  check: (source) =>
    (source === 'vue' || frameworkImportPrefixes.some((prefix) => source.startsWith(prefix))) &&
    `@open-pencil/core must stay framework-agnostic; do not import '${source}'.`
})

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
      '/src/app/shell/layout-storage.ts',
      '/packages/vue/src/i18n/locale.ts'
    ]
    if (allowedFiles.some((suffix) => file.endsWith(suffix))) return {}

    function reportStorage(node, name) {
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
        if (isUnknownTypeAnnotation(node.expression?.typeAnnotation)) {
          context.report({
            node,
            message: 'Avoid `as unknown as ...`; model the value with a precise type or helper.'
          })
        }
      }
    }
  }
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
        if (!isUnknownTypeAnnotation(node.expression?.typeAnnotation)) return
        const targetType = context.sourceCode.getText(node.typeAnnotation).replace(/\s+/g, '')
        if (targetType !== 'Record<string,unknown>') return
        context.report({
          node,
          message:
            'Avoid `as unknown as Record<string, unknown>`; use a precise type or direct public API.'
        })
      }
    }
  }
}

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
}

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
}

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
}

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
}

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
}

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
}

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
}

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

    function intervalName(callee) {
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
}

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
}

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

    const max = context.options[0]?.max ?? 260

    return {
      Program(node) {
        const lineCount = context.sourceCode.getText().split('\n').length
        if (lineCount <= max) return
        context.report({
          node,
          message: `Composition root is ${lineCount} lines; extract helpers before exceeding ${max} lines.`
        })
      }
    }
  }
}

function isPascalCaseName(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name)
}

function isKebabOrLowercaseName(name) {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)
}

const vueComponentFilePascalCase = {
  meta: {
    docs: {
      description: 'Require Vue component files to use PascalCase names'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue')) return {}

    return {
      Program(node) {
        const basename =
          file
            .split('/')
            .at(-1)
            ?.replace(/\.vue$/, '') ?? ''
        if (isPascalCaseName(basename)) return
        context.report({
          node,
          message: 'Vue component files must use PascalCase names.'
        })
      }
    }
  }
}

const componentNamespacePascalCase = {
  meta: {
    docs: {
      description: 'Require component namespace folders to use PascalCase names'
    }
  },
  create(context) {
    const file = normalizedFilename(context)

    return {
      Program(node) {
        const primitiveMatch = file.match(/\/packages\/vue\/src\/primitives\/([^/]+)/)
        if (primitiveMatch && !isPascalCaseName(primitiveMatch[1])) {
          context.report({
            node,
            message: `Vue primitive namespace folder '${primitiveMatch[1]}' must use PascalCase.`
          })
          return
        }

        const componentMatch = file.match(/\/src\/components\/(.+)$/)
        if (!componentMatch) return

        const parts = componentMatch[1].split('/')
        const first = parts[0]
        const second = parts[1]
        const allowedGroups = new Set(['chat', 'properties', 'ui'])

        if (parts.length > 1 && !allowedGroups.has(first) && !isPascalCaseName(first)) {
          context.report({
            node,
            message: `Component namespace folder '${first}' must use PascalCase.`
          })
          return
        }

        if (
          parts.length > 2 &&
          (first === 'chat' || first === 'properties') &&
          second !== undefined &&
          !isPascalCaseName(second)
        ) {
          context.report({
            node,
            message: `Nested component namespace folder '${first}/${second}' must use PascalCase.`
          })
        }
      }
    }
  }
}

const nonComponentSourceDirectoriesKebabCase = {
  meta: {
    docs: {
      description: 'Require non-component source directories to use lowercase or kebab-case names'
    }
  },
  create(context) {
    const file = normalizedFilename(context)

    const roots = [
      '/src/app/',
      '/packages/core/src/',
      '/packages/cli/src/',
      '/packages/mcp/src/',
      '/packages/vue/src/canvas/',
      '/packages/vue/src/controls/',
      '/packages/vue/src/document/',
      '/packages/vue/src/editor/',
      '/packages/vue/src/i18n/',
      '/packages/vue/src/internal/',
      '/packages/vue/src/shared/',
      '/packages/vue/src/variables/'
    ]

    const root = roots.find((candidate) => file.includes(candidate))
    if (!root) return {}

    return {
      Program(node) {
        const relativePath = file.slice(file.indexOf(root) + root.length)
        const directories = relativePath.split('/').slice(0, -1)
        const invalid = directories.find((part) => !isKebabOrLowercaseName(part))
        if (!invalid) return
        context.report({
          node,
          message: `Non-component source directory '${invalid}' must use lowercase or kebab-case.`
        })
      }
    }
  }
}

const noComponentRootSiblingFolder = {
  meta: {
    docs: {
      description: 'Disallow multi-file component roots beside their namespace folder'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const match = file.match(/\/src\/components\/(?:chat\/|properties\/)?([A-Z][A-Za-z0-9]*)\.vue$/)
    if (!match) return {}

    return {
      Program(node) {
        const dir = file.replace(/\.vue$/, '')
        if (!existsSync(dir)) return
        context.report({
          node,
          message: `Move '${match[1]}.vue' inside its '${match[1]}/' component namespace folder.`
        })
      }
    }
  }
}

const noUselessPassThroughWrappers = {
  meta: {
    docs: {
      description:
        'Disallow functions that only return another function call with the same arguments'
    }
  },
  create(context) {
    function paramNames(params) {
      const names = []
      for (const param of params ?? []) {
        if (param.type !== 'Identifier') return null
        names.push(param.name)
      }
      return names
    }

    function returnedCall(body) {
      if (!body) return null
      if (body.type === 'CallExpression') return body
      if (body.type !== 'BlockStatement') return null
      const statements = body.body?.filter((statement) => statement.type !== 'EmptyStatement') ?? []
      if (statements.length !== 1) return null
      const statement = statements[0]
      if (statement.type !== 'ReturnStatement') return null
      return statement.argument?.type === 'CallExpression' ? statement.argument : null
    }

    function calleeName(callee) {
      return callee?.type === 'Identifier' ? callee.name : null
    }

    function isSameArgumentForwarding(args, params) {
      if (args?.length !== params.length) return false
      return args.every((arg, index) => arg.type === 'Identifier' && arg.name === params[index])
    }

    function check(node, name, params, body) {
      const names = paramNames(params)
      if (!names) return
      const call = returnedCall(body)
      if (!call || !isSameArgumentForwarding(call.arguments, names)) return
      const target = calleeName(call.callee)
      if (!target || target === name) return
      context.report({
        node,
        message: `Remove pass-through wrapper '${name}'. Call '${target}' directly or give the wrapper real domain logic.`
      })
    }

    return {
      FunctionDeclaration(node) {
        if (!node.id?.name) return
        check(node, node.id.name, node.params, node.body)
      },
      VariableDeclarator(node) {
        if (node.id?.type !== 'Identifier') return
        const init = node.init
        if (
          !init ||
          (init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression')
        )
          return
        check(node, node.id.name, init.params, init.body)
      }
    }
  }
}

const noFunctionAliasImports = {
  meta: {
    docs: {
      description: 'Disallow import aliases ending in Fn for facade delegation'
    }
  },
  create(context) {
    return {
      ImportSpecifier(node) {
        if (!node.imported || !node.local) return
        if (node.imported.type !== 'Identifier' || node.local.type !== 'Identifier') return
        if (node.imported.name === node.local.name) return
        if (!node.local.name.endsWith('Fn')) return
        context.report({
          node,
          message:
            'Avoid aliasing imports as *Fn. Use a namespace import or give the exported helper a clearer domain name.'
        })
      }
    }
  }
}

const noDirectOpenPencilBrowserStore = {
  meta: {
    docs: {
      description: 'Disallow direct window.openPencil.store access'
    }
  },
  create(context) {
    function propertyName(property) {
      if (property?.type === 'Identifier') return property.name
      if (property?.type === 'Literal' && typeof property.value === 'string') return property.value
      return null
    }

    function isOpenPencilMember(node) {
      return (
        node?.type === 'MemberExpression' &&
        propertyName(node.property) === 'openPencil' &&
        ((node.object?.type === 'Identifier' && node.object.name === 'window') ||
          (node.object?.type === 'Identifier' && node.object.name === 'globalThis'))
      )
    }

    return {
      MemberExpression(node) {
        if (propertyName(node.property) !== 'store') return
        if (!isOpenPencilMember(node.object)) return
        context.report({
          node,
          message: 'Use window.openPencil.getStore() instead of accessing window.openPencil.store directly.'
        })
      }
    }
  }
}

const noDirectOpenPencilWindowInternals = {
  meta: {
    docs: {
      description: 'Disallow direct access to private OpenPencil window internals'
    }
  },
  create(context) {
    function propertyName(property) {
      if (property?.type === 'Identifier') return property.name
      if (property?.type === 'Literal' && typeof property.value === 'string') return property.value
      return null
    }

    return {
      MemberExpression(node) {
        const name = propertyName(node.property)
        if (!name?.startsWith('__OPEN_PENCIL')) return
        context.report({
          node,
          message:
            'Do not access window.__OPEN_PENCIL* directly. Use src/app/browser-bridge.ts or tests/helpers/store.ts instead.'
        })
      }
    }
  }
}

const noTopLevelPrefixedTestFiles = createProgramFilenameRule({
  description: 'Disallow top-level test files that encode domains as filename prefixes',
  check(file) {
    const match = file.match(/\/tests\/(engine|e2e)\/([^/]+-[^/]+\.(?:test|spec)\.ts)$/)
    if (!match) return false
    return `Move '${match[2]}' under a domain folder instead of encoding the domain as a filename prefix.`
  }
})

const noSiblingDomainPrefixedFiles = createProgramFilenameRule({
  description: 'Disallow files that repeat an existing sibling domain folder as a filename prefix',
  check(file) {
    const match = file.match(/^(.*\/)([^/]+)-[^/]+\.(?:test\.)?(?:spec\.)?(?:ts|tsx|vue)$/)
    if (!match) return false

    const [, dir, prefix] = match
    if (!existsSync(`${dir}${prefix}`)) return false

    const filename = file.slice(dir.length)
    return `Move '${filename}' under the existing '${prefix}/' folder instead of repeating the domain as a filename prefix.`
  }
})

const noFlatKiwiModules = createProgramFilenameRule({
  description: 'Disallow flat top-level Kiwi modules — group code under Kiwi subdomains',
  check(file) {
    const marker = '/packages/core/src/kiwi/'
    const start = file.indexOf(marker)
    if (start === -1) return false

    const relativePath = file.slice(start + marker.length)
    if (relativePath.includes('/') || relativePath === 'index.ts') return false

    return 'Move Kiwi modules under binary/, fig/, node-change/, instance-overrides/, or kiwi-schema/ instead of adding flat top-level files.'
  }
})

const plugin = {
  meta: { name: 'open-pencil' },
  rules: {
    'no-inline-named-types': noInlineNamedTypes,
    'no-structuredclone-scene-arrays': noStructuredCloneSceneArrays,
    'no-vue-style-blocks': noVueStyleBlocks,
    'no-raw-test-id-string-props': noRawTestIdStringProps,
    'no-dynamic-data-test-id-in-vue': noDynamicDataTestIdInVue,
    'no-test-id-helper-bind-in-vue': noTestIdHelperBindInVue,
    'no-invalid-test-id-attributes': noInvalidTestIdAttributes,
    'no-generated-test-id-literals': noGeneratedTestIdLiterals,
    'no-document-query-selector-in-vue': noDocumentQuerySelectorInVue,
    'no-direct-selection-tool-state-mutation': noDirectSelectionToolStateMutation,
    'no-math-random': noMathRandom,
    'no-hand-rolled-color': noHandRolledColor,
    'no-raw-console-format': noRawConsoleFormat,
    'no-silent-catch': noSilentCatch,
    'no-typeof-window-check': noTypeofWindowCheck,
    'no-vue-self-package-imports': noVueSelfPackageImports,
    'no-cross-package-source-imports': noCrossPackageSourceImports,
    'no-deep-parent-relative-imports': noDeepParentRelativeImports,
    'no-core-parent-relative-imports': noCoreParentRelativeImports,
    'no-mcp-parent-relative-imports': noMcpParentRelativeImports,
    'no-vue-parent-relative-imports': noVueParentRelativeImports,
    'no-cli-parent-relative-imports': noCliParentRelativeImports,
    'no-mcp-core-barrel-imports': noMcpCoreBarrelImports,
    'no-cli-core-barrel-imports': noCliCoreBarrelImports,
    'no-script-core-barrel-imports': noScriptCoreBarrelImports,
    'no-core-self-package-imports': noCoreSelfPackageImports,
    'no-inline-prompt-constants': noInlinePromptConstants,
    'no-app-vue-core-barrel-imports': noAppVueCoreBarrelImports,
    'no-app-imports-in-packages': noAppImportsInPackages,
    'no-core-framework-imports': noCoreFrameworkImports,
    'no-direct-storage-access': noDirectStorageAccess,
    'no-broad-double-cast': noBroadDoubleCast,
    'no-unknown-record-double-cast': noUnknownRecordDoubleCast,
    'no-ts-suppression-comments': noTsSuppressionComments,
    'no-function-type': noFunctionType,
    'no-reflect-delete-global-this-outside-tests': noReflectDeleteGlobalThisOutsideTests,
    'no-core-browser-globals': noCoreBrowserGlobals,
    'no-direct-open-pencil-window-internals': noDirectOpenPencilWindowInternals,
    'no-direct-open-pencil-browser-store': noDirectOpenPencilBrowserStore,
    'no-direct-graph-emitter-subscriptions': noDirectGraphEmitterSubscriptions,
    'no-on-unmounted-in-composition-roots': noOnUnmountedInCompositionRoots,
    'no-composable-state-wrappers': noComposableStateWrappers,
    'prefer-vueuse-intervals': preferVueUseIntervals,
    'prefer-vueuse-timeouts': preferVueUseTimeouts,
    'max-composition-root-lines': maxCompositionRootLines,
    'vue-component-file-pascal-case': vueComponentFilePascalCase,
    'component-namespace-pascal-case': componentNamespacePascalCase,
    'non-component-source-directories-kebab-case': nonComponentSourceDirectoriesKebabCase,
    'no-component-root-sibling-folder': noComponentRootSiblingFolder,
    'no-useless-pass-through-wrappers': noUselessPassThroughWrappers,
    'no-function-alias-imports': noFunctionAliasImports,
    'no-flat-kiwi-modules': noFlatKiwiModules,
    'no-top-level-prefixed-test-files': noTopLevelPrefixedTestFiles,
    'no-sibling-domain-prefixed-files': noSiblingDomainPrefixedFiles
  }
}

export default plugin
