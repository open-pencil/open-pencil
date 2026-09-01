import {
  noConditionalObjectSpreads,
  noFlatKiwiModules,
  noMixedCaseAcronymIdentifiers
} from '#lint/rules/policy.ts'
import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import type { TSESTree } from '@typescript-eslint/utils'

import type { Color } from '@open-pencil/scene-graph'

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

    const shapeToName = new Map<string, string>()
    for (const [name, shape] of Object.entries(typesOption)) {
      if (typeof shape === 'string') shapeToName.set(shape, name)
    }

    return {
      TSTypeLiteral(node) {
        const props = node.members?.filter(
          (member) => member.type === 'TSPropertySignature' && member.key?.type === 'Identifier'
        )
        if (!props || props.length < 2) return

        const shape = props
          .map((member) => {
            if (member.type !== 'TSPropertySignature' || member.key.type !== 'Identifier') {
              return ''
            }
            const typeNode = member.typeAnnotation?.typeAnnotation
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
            return `${member.key.name}:${typeName}`
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
} satisfies RuleDefinition

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
    const configuredProperties = context.options[0]
    const props = new Set<string>(
      Array.isArray(configuredProperties)
        ? configuredProperties.filter((value): value is string => typeof value === 'string')
        : ['fills', 'strokes', 'effects', 'styleRuns', 'fillGeometry', 'strokeGeometry']
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
} satisfies RuleDefinition

import {
  noVueStyleBlocks,
  noNativeTitleAttributesInVue,
  noHardcodedTipLabelsInVue,
  noRawSvgInAppVueTemplates,
  noUiHelperCallsInVueTemplates,
  noLargePropertySectionComponents,
  noRawTestIdStringProps,
  noDynamicDataTestIdInVue,
  noTestIdHelperBindInVue,
  noInvalidTestIdAttributes,
  noRawTestIdSelectorsInTests,
  noGeneratedTestIdLiterals,
  noBrowserSideEffectsInVue,
  noDocumentQuerySelectorInVue
} from '#lint/rules/vue/index.ts'

const noDirectSelectionToolStateMutation = {
  meta: {
    docs: {
      description:
        'Disallow direct editor selection/tool state assignment outside core editor internals'
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
} satisfies RuleDefinition

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
} satisfies RuleDefinition

function isNumericLiteral(node: TSESTree.Node | undefined, value: number): boolean {
  return node?.type === 'Literal' && node.value === value
}

function colorObjectLiteral(node: TSESTree.ObjectExpression, color: Color): boolean {
  if (node?.type !== 'ObjectExpression') return false
  const props = new Map<string, TSESTree.Node>()
  for (const prop of node.properties ?? []) {
    if (prop.type !== 'Property') return false
    let key: string | null = null
    if (prop.key.type === 'Identifier') key = prop.key.name
    else if (prop.key.type === 'Literal') key = String(prop.key.value)
    if (key === null) return false
    props.set(key, prop.value)
  }
  return Object.entries(color).every(([key, value]) => isNumericLiteral(props.get(key), value))
}

const noHardcodedColorConstants = {
  meta: {
    docs: {
      description:
        'Use named color constants instead of inline Color object literals for shared colors'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (file.includes('/tests/') || file.endsWith('/packages/core/src/constants.ts')) return {}

    return {
      ObjectExpression(node) {
        if (colorObjectLiteral(node, { r: 0, g: 0, b: 0, a: 1 })) {
          context.report({
            node,
            message: 'Use BLACK from constants instead of an inline black Color literal.'
          })
        }
        if (colorObjectLiteral(node, { r: 0, g: 0, b: 0, a: 0 })) {
          context.report({
            node,
            message:
              'Use TRANSPARENT from constants instead of an inline transparent Color literal.'
          })
        }
      }
    }
  }
} satisfies RuleDefinition

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
        const hasHandRolledRgb = node.quasis?.some((quasi) => {
          const raw = quasi.value?.raw
          return typeof raw === 'string' && (raw.includes('rgb(') || raw.includes('rgba('))
        })
        if (!hasHandRolledRgb) return
        context.report({
          node,
          message:
            'Use colorToCSS() or colorToHex() from color.ts instead of hand-rolled rgba()/rgb() strings.'
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

import {
  noVueSelfPackageImports,
  noCrossPackageSourceImports,
  noDeepParentRelativeImports,
  noCoreParentRelativeImports,
  noMcpParentRelativeImports,
  noVueParentRelativeImports,
  noCliParentRelativeImports,
  noMcpCoreBarrelImports,
  noCliCoreBarrelImports,
  noScriptCoreBarrelImports,
  noCoreSelfPackageImports,
  noInlinePromptConstants,
  noAppVueCoreBarrelImports,
  noAppImportsInPackages,
  noCoreFrameworkImports
} from '#lint/rules/imports.ts'
import {
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
} from '#lint/rules/runtime.ts'
import {
  vueComponentFilePascalCase,
  componentNamespaceCasing,
  nonComponentSourceDirectoriesKebabCase,
  noComponentRootSiblingFolder,
  noUselessPassThroughWrappers,
  noFunctionAliasImports,
  noDirectOpenPencilBrowserStore,
  noDirectOpenPencilWindowInternals,
  noBunGlobalsInCli,
  noTopLevelPrefixedTestFiles,
  noSiblingDomainPrefixedFiles
} from '#lint/rules/structure.ts'
import {
  noBroadUnknownTypeAssertions,
  noDuplicateTypeShapes,
  noLocalJsonObjectAliases,
  noImportTypeAnnotations
} from '#lint/rules/typescript.ts'

const plugin = {
  meta: { name: 'open-pencil' },
  rules: {
    'no-inline-named-types': noInlineNamedTypes,
    'no-import-type-annotations': noImportTypeAnnotations,
    'no-structuredclone-scene-arrays': noStructuredCloneSceneArrays,
    'no-vue-style-blocks': noVueStyleBlocks,
    'no-native-title-attributes-in-vue': noNativeTitleAttributesInVue,
    'no-hardcoded-tip-labels-in-vue': noHardcodedTipLabelsInVue,
    'no-raw-svg-in-app-vue-templates': noRawSvgInAppVueTemplates,
    'no-ui-helper-calls-in-vue-templates': noUiHelperCallsInVueTemplates,
    'no-large-property-section-components': noLargePropertySectionComponents,
    'no-raw-test-id-string-props': noRawTestIdStringProps,
    'no-dynamic-data-test-id-in-vue': noDynamicDataTestIdInVue,
    'no-test-id-helper-bind-in-vue': noTestIdHelperBindInVue,
    'no-invalid-test-id-attributes': noInvalidTestIdAttributes,
    'no-raw-test-id-selectors-in-tests': noRawTestIdSelectorsInTests,
    'no-generated-test-id-literals': noGeneratedTestIdLiterals,
    'no-browser-side-effects-in-vue': noBrowserSideEffectsInVue,
    'no-document-query-selector-in-vue': noDocumentQuerySelectorInVue,
    'no-direct-selection-tool-state-mutation': noDirectSelectionToolStateMutation,
    'no-math-random': noMathRandom,
    'no-hardcoded-color-constants': noHardcodedColorConstants,
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
    'no-broad-unknown-type-assertions': noBroadUnknownTypeAssertions,
    'no-local-json-object-aliases': noLocalJsonObjectAliases,
    'no-duplicate-type-shapes': noDuplicateTypeShapes,
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
    'component-namespace-casing': componentNamespaceCasing,
    'non-component-source-directories-kebab-case': nonComponentSourceDirectoriesKebabCase,
    'no-component-root-sibling-folder': noComponentRootSiblingFolder,
    'no-useless-pass-through-wrappers': noUselessPassThroughWrappers,
    'no-function-alias-imports': noFunctionAliasImports,
    'no-mixed-case-acronym-identifiers': noMixedCaseAcronymIdentifiers,
    'no-flat-kiwi-modules': noFlatKiwiModules,
    'no-bun-globals-in-cli': noBunGlobalsInCli,
    'no-top-level-prefixed-test-files': noTopLevelPrefixedTestFiles,
    'no-conditional-object-spreads': noConditionalObjectSpreads,
    'no-sibling-domain-prefixed-files': noSiblingDomainPrefixedFiles
  }
}

export default plugin
