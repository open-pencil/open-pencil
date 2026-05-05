import { existsSync } from 'node:fs'

function normalizedFilename(context) {
  return (context.filename ?? context.getFilename?.() ?? '').replace(/\\/g, '/')
}

function importSource(node) {
  return typeof node.source?.value === 'string' ? node.source.value : null
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

const noLegacyAppImports = {
  meta: {
    docs: {
      description:
        'Disallow imports from removed app/store compatibility shims — import canonical src/app modules instead'
    }
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = importSource(node)
        if (!source) return
        const legacyPrefixes = [
          '@/ai/',
          '@/automation/',
          '@/stores/',
          '@/composables/use-canvas',
          '@/composables/use-canvas-input',
          '@/composables/use-collab',
          '@/composables/use-keyboard'
        ]
        if (legacyPrefixes.some((prefix) => source === prefix || source.startsWith(prefix))) {
          context.report({
            node,
            message: `Import from the canonical src/app module instead of legacy shim '${source}'.`
          })
        }
      }
    }
  }
}

const noVueSelfPackageImports = {
  meta: {
    docs: {
      description: 'Disallow @open-pencil/vue self-imports inside the Vue SDK — use #vue/* aliases'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/packages/vue/src/')) return {}

    return {
      ImportDeclaration(node) {
        const source = importSource(node)
        if (!source?.startsWith('@open-pencil/vue')) return
        context.report({
          node,
          message: `Use #vue/* for internal Vue SDK imports instead of self-package import '${source}'.`
        })
      }
    }
  }
}

const noCrossPackageSourceImports = {
  meta: {
    docs: {
      description:
        'Disallow imports that reach into another workspace package source tree — use package exports or package-local aliases'
    }
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = importSource(node)
        if (!source) return
        if (
          source.includes('/packages/') ||
          /^(?:\.\.\/){2,}packages\//.test(source) ||
          /^(?:\.\.\/)+(?:core|vue|cli|mcp)\/src\//.test(source)
        ) {
          context.report({
            node,
            message: `Use workspace package exports or package-local aliases instead of cross-package source import '${source}'.`
          })
        }
      }
    }
  }
}

const noStaleViteAppPaths = {
  meta: {
    docs: {
      description: 'Disallow stale Vite config paths to removed top-level app folders'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('/vite.config.ts')) return {}

    function reportIfStale(node, value) {
      if (typeof value !== 'string') return
      if (!value.includes('src/automation') && !value.includes('src/shims')) return
      context.report({
        node,
        message: 'Use current src/app/* paths instead of removed src/automation or src/shims paths.'
      })
    }

    return {
      Literal(node) {
        reportIfStale(node, node.value)
      },
      TemplateElement(node) {
        reportIfStale(node, node.value?.raw)
      }
    }
  }
}

function createParentRelativeImportRule({ description, applies, message }) {
  return {
    meta: {
      docs: { description }
    },
    create(context) {
      const file = normalizedFilename(context)
      if (!applies(file)) return {}

      function reportSource(node, source) {
        if (!source?.startsWith('../')) return
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

const noRootDemoModule = {
  meta: {
    docs: {
      description: 'Disallow root src/demo.ts — keep demo builders under src/app/demo'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('/src/demo.ts')) return {}

    return {
      Program(node) {
        context.report({
          node,
          message: 'Move demo document builders under src/app/demo instead of root src/demo.ts.'
        })
      }
    }
  }
}

function createExactCoreBarrelImportRule({ description, applies, message }) {
  return {
    meta: {
      docs: { description }
    },
    create(context) {
      const file = normalizedFilename(context)
      if (!applies(file)) return {}

      return {
        ImportDeclaration(node) {
          const source = importSource(node)
          if (source !== '@open-pencil/core') return
          context.report({ node, message })
        }
      }
    }
  }
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

const noCoreSelfPackageImports = {
  meta: {
    docs: {
      description: 'Disallow @open-pencil/core self-imports inside packages/core/src'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/packages/core/src/')) return {}

    return {
      ImportDeclaration(node) {
        const source = importSource(node)
        if (!source?.startsWith('@open-pencil/core')) return
        context.report({
          node,
          message:
            'Core internals must import local modules directly instead of importing the @open-pencil/core public package entrypoints.'
        })
      }
    }
  }
}

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

const noLegacyAppSupportImports = {
  meta: {
    docs: {
      description: 'Disallow imports from legacy top-level app support folders'
    }
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = importSource(node)
        if (!source || !/^@\/(?:utils|engine)\//.test(source)) return
        context.report({
          node,
          message:
            'Move app support imports to cohesive src/app modules instead of using legacy @/utils/* or @/engine/* paths.'
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

const noAppImportsInPackages = {
  meta: {
    docs: {
      description: 'Disallow app-shell imports from workspace packages'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/packages/')) return {}

    return {
      ImportDeclaration(node) {
        const source = importSource(node)
        if (!source?.startsWith('@/')) return
        context.report({
          node,
          message: `Workspace packages must not import app-shell alias '${source}'.`
        })
      }
    }
  }
}

const noCoreFrameworkImports = {
  meta: {
    docs: {
      description: 'Keep @open-pencil/core framework-agnostic by disallowing Vue/Tauri/app imports'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/packages/core/src/')) return {}

    return {
      ImportDeclaration(node) {
        const source = importSource(node)
        if (!source) return
        if (
          source === 'vue' ||
          source.startsWith('@vue/') ||
          source.startsWith('@open-pencil/vue') ||
          source.startsWith('@tauri-apps/') ||
          source.startsWith('@/')
        ) {
          context.report({
            node,
            message: `@open-pencil/core must stay framework-agnostic; do not import '${source}'.`
          })
        }
      }
    }
  }
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

const noLegacyShimFiles = {
  meta: {
    docs: {
      description: 'Disallow recreating removed compatibility shim files'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const blocked = [
      '/src/stores/editor.ts',
      '/src/stores/tabs.ts',
      '/src/composables/use-canvas.ts',
      '/src/composables/use-canvas-input.ts',
      '/src/composables/use-collab.ts',
      '/src/composables/use-keyboard.ts'
    ]
    const blockedDirs = ['/src/ai/', '/src/automation/']
    const isBlocked =
      blocked.some((suffix) => file.endsWith(suffix)) ||
      blockedDirs.some((segment) => file.includes(segment))

    if (!isBlocked) return {}

    return {
      Program(node) {
        context.report({
          node,
          message: 'Do not recreate removed compatibility shims; use the canonical src/app module.'
        })
      }
    }
  }
}

const noLegacyTestAppImports = {
  meta: {
    docs: {
      description: 'Disallow tests importing removed top-level app modules'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/tests/')) return {}

    function reportLegacyTestImport(node) {
      const source = importSource(node)
      if (
        !source ||
        !/^(?:\.\.\/)+src\/(?:ai|automation|composables|stores|utils|engine)\//.test(source)
      ) {
        return
      }
      context.report({
        node,
        message: 'Use the current src/app/* module path instead of a removed top-level app module.'
      })
    }

    return {
      ExportAllDeclaration: reportLegacyTestImport,
      ExportNamedDeclaration: reportLegacyTestImport,
      ImportDeclaration: reportLegacyTestImport
    }
  }
}

const noTestCoreSourceImports = {
  meta: {
    docs: {
      description: 'Disallow tests importing non-vendored core internals by relative source path'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/tests/')) return {}

    function reportCoreSourceImport(node) {
      const source = importSource(node)
      if (!source || !/^(?:\.\.\/)+packages\/core\/src\/(?!kiwi\/kiwi-schema)/.test(source)) {
        return
      }
      context.report({
        node,
        message: 'Use #core/* instead of a relative packages/core/src import in tests.'
      })
    }

    return {
      ExportAllDeclaration: reportCoreSourceImport,
      ExportNamedDeclaration: reportCoreSourceImport,
      ImportDeclaration: reportCoreSourceImport,
      ImportExpression: reportCoreSourceImport
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

const noFlatKiwiModules = {
  meta: {
    docs: {
      description: 'Disallow flat top-level Kiwi modules — group code under Kiwi subdomains'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const marker = '/packages/core/src/kiwi/'
    const start = file.indexOf(marker)
    if (start === -1) return {}

    const relativePath = file.slice(start + marker.length)
    if (relativePath.includes('/') || relativePath === 'index.ts') return {}

    return {
      Program(node) {
        context.report({
          node,
          message:
            'Move Kiwi modules under binary/, fig/, node-change/, instance-overrides/, or kiwi-schema/ instead of adding flat top-level files.'
        })
      }
    }
  }
}

const plugin = {
  meta: { name: 'open-pencil' },
  rules: {
    'no-inline-named-types': noInlineNamedTypes,
    'no-structuredclone-scene-arrays': noStructuredCloneSceneArrays,
    'no-math-random': noMathRandom,
    'no-hand-rolled-color': noHandRolledColor,
    'no-raw-console-format': noRawConsoleFormat,
    'no-silent-catch': noSilentCatch,
    'no-typeof-window-check': noTypeofWindowCheck,
    'no-legacy-app-imports': noLegacyAppImports,
    'no-vue-self-package-imports': noVueSelfPackageImports,
    'no-cross-package-source-imports': noCrossPackageSourceImports,
    'no-core-parent-relative-imports': noCoreParentRelativeImports,
    'no-mcp-parent-relative-imports': noMcpParentRelativeImports,
    'no-vue-parent-relative-imports': noVueParentRelativeImports,
    'no-stale-vite-app-paths': noStaleViteAppPaths,
    'no-cli-parent-relative-imports': noCliParentRelativeImports,
    'no-root-demo-module': noRootDemoModule,
    'no-mcp-core-barrel-imports': noMcpCoreBarrelImports,
    'no-cli-core-barrel-imports': noCliCoreBarrelImports,
    'no-script-core-barrel-imports': noScriptCoreBarrelImports,
    'no-core-self-package-imports': noCoreSelfPackageImports,
    'no-inline-prompt-constants': noInlinePromptConstants,
    'no-legacy-app-support-imports': noLegacyAppSupportImports,
    'no-app-vue-core-barrel-imports': noAppVueCoreBarrelImports,
    'no-app-imports-in-packages': noAppImportsInPackages,
    'no-core-framework-imports': noCoreFrameworkImports,
    'no-direct-storage-access': noDirectStorageAccess,
    'no-legacy-shim-files': noLegacyShimFiles,
    'no-legacy-test-app-imports': noLegacyTestAppImports,
    'no-test-core-source-imports': noTestCoreSourceImports,
    'no-broad-double-cast': noBroadDoubleCast,
    'no-unknown-record-double-cast': noUnknownRecordDoubleCast,
    'no-ts-suppression-comments': noTsSuppressionComments,
    'no-core-browser-globals': noCoreBrowserGlobals,
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
    'no-flat-kiwi-modules': noFlatKiwiModules
  }
}

export default plugin
