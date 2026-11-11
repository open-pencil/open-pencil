import { normalizedFilename, staticPropertyName } from '#lint/support/context.ts'
import type { RuleContext, RuleDefinition } from '#lint/support/types.ts'
import {
  VUE_SIMPLE_EXPRESSION_NODE,
  vueTemplateAst,
  walkExpressionAst,
  walkVueTemplateAst,
  type ExpressionAstNode,
  type VueTemplateNode
} from '#lint/support/vue.ts'
import type { TSESTree } from '@typescript-eslint/utils'

/** Modules that draw document content into the cached scene. */
const SCENE_DRAWING_FILES = [
  '/packages/core/src/canvas/scene.ts',
  '/packages/core/src/canvas/strokes.ts',
  '/packages/core/src/canvas/fills.ts',
  '/packages/core/src/canvas/boolean.ts'
]

const SCENE_DRAWING_DIRECTORIES = ['/packages/core/src/canvas/text/']

/** Whether `node` is an argument of `effectRasterScale(...)`, not inside a function passed to it. */
function inEffectRasterScale(node: TSESTree.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionExpression' ||
      current.type === 'FunctionDeclaration'
    )
      return false
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'Identifier' &&
      current.callee.name === 'effectRasterScale'
    )
      return true
  }
  return false
}

const noZoomInSceneDrawing = {
  meta: {
    docs: {
      description:
        'Disallow reading the zoom where document content is drawn: the scene is cached and scaled, so screen-sized chrome belongs in the overlay pass'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    const scene =
      SCENE_DRAWING_FILES.some((suffix) => file.endsWith(suffix)) ||
      SCENE_DRAWING_DIRECTORIES.some((directory) => file.includes(directory))
    if (!scene) return {}

    return {
      MemberExpression(node) {
        if (node.computed || node.property.type !== 'Identifier') return
        if (node.property.name !== 'zoom' || inEffectRasterScale(node)) return
        context.report({
          node,
          message:
            'Do not size scene drawing by the zoom; the scene is cached and scaled while navigating. Draw screen-sized chrome in the overlay pass with withScreenStroke.'
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

const noDirectOpenPencilBrowserStore = {
  meta: {
    docs: {
      description: 'Disallow direct window.openPencil.store access'
    }
  },
  create(context) {
    function isOpenPencilMember(node: TSESTree.Expression): boolean {
      return (
        node?.type === 'MemberExpression' &&
        staticPropertyName(node.property) === 'openPencil' &&
        ((node.object?.type === 'Identifier' && node.object.name === 'window') ||
          (node.object?.type === 'Identifier' && node.object.name === 'globalThis'))
      )
    }

    return {
      MemberExpression(node) {
        if (staticPropertyName(node.property) !== 'store') return
        if (!isOpenPencilMember(node.object)) return
        context.report({
          node,
          message:
            'Use window.openPencil.getStore() instead of accessing window.openPencil.store directly.'
        })
      }
    }
  }
} satisfies RuleDefinition

const noDirectOpenPencilWindowInternals = {
  meta: {
    docs: {
      description: 'Disallow direct access to private OpenPencil window internals'
    }
  },
  create(context) {
    return {
      MemberExpression(node) {
        const name = staticPropertyName(node.property)
        if (!name?.startsWith('__OPEN_PENCIL')) return
        context.report({
          node,
          message:
            'Do not access window.__OPEN_PENCIL* directly. Use src/app/browser-bridge.ts or tests/helpers/store.ts instead.'
        })
      }
    }
  }
} satisfies RuleDefinition

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

/** A key when it is fixed (`key`, `'key'`, `` `key` ``), not one read from a variable. */
function fixedKey(key: TSESTree.Node, computed: boolean): string | null {
  if (key.type === 'Identifier') return computed ? null : key.name
  if (key.type === 'Literal') return typeof key.value === 'string' ? key.value : null
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? null
  }
  return null
}

const CORE_PROFILE = ['/packages/core/src/editor/views/', '/packages/core/src/editor/state/']

/** The app's own services, as opposed to its views and components. */
function isAppService(file: string): boolean {
  return file.includes('/src/app/') && !file.includes('/packages/')
}

/** Front ends: the Vue SDK, the app's views and components, and the docs site's theme. */
function isFrontEnd(file: string): boolean {
  return (
    file.includes('/packages/vue/src/') ||
    (!file.includes('/packages/') && file.includes('/src/') && !isAppService(file)) ||
    file.includes('/packages/docs/.vitepress/theme/')
  )
}

/**
 * What the editor profile resolves from, and the code that may read each: Core's views and state
 * own them all, the read-only module applies the restrictions, the app, as the host, sets them,
 * and the document's kind is the graph's own field, which formats save; front ends read the
 * profile instead.
 */
const PROFILE_INPUTS: Record<string, (file: string) => boolean> = {
  canvasView: (file) => CORE_PROFILE.some((owner) => file.includes(owner)),
  hostRestrictions: (file) =>
    CORE_PROFILE.some((owner) => file.includes(owner)) ||
    file.includes('/packages/core/src/editor/read-only/') ||
    isAppService(file),
  documentKind: (file) => !isFrontEnd(file)
}

/** The fixed key a template member expression reads (`a.key`, `a['key']`), or null. */
function templateMemberKey(node: ExpressionAstNode): string | null {
  if (node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression') return null
  const key = node.property as ExpressionAstNode | undefined
  if (node.computed !== true && key?.type === 'Identifier') return key.name ?? null
  if (key?.type === 'StringLiteral' && typeof key.value === 'string') return key.value
  return null
}

/** The profile inputs a Vue template expression reads. */
function templateProfileInputs(expression: VueTemplateNode, inputs: Set<string>): string[] {
  if (expression.type !== VUE_SIMPLE_EXPRESSION_NODE || !expression.ast) return []
  const found: string[] = []
  walkExpressionAst(expression.ast as ExpressionAstNode, (node) => {
    const key = templateMemberKey(node)
    if (key && inputs.has(key)) found.push(key)
  })
  return found
}

function profileInputMessage(input: string): string {
  return `Read how the editor behaves from resolveEditorProfile instead of its ${input}.`
}

/**
 * The editor behaves by the profile its canvas view resolves to, narrowed by the host's
 * restrictions, so other code reads the profile's values, never those inputs: checks of the view
 * and of read-only are how each came to branch at every place the editor behaves differently.
 */
const noEditorProfileInputs: RuleDefinition = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Disallow reading the editor profile's inputs (canvas view, restrictions) outside their owners — read resolveEditorProfile instead"
    },
    schema: []
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/src/') && !file.includes('/packages/docs/.vitepress/theme/')) return {}
    const inputs = new Set(
      Object.keys(PROFILE_INPUTS).filter((input) => !PROFILE_INPUTS[input]?.(file))
    )
    if (inputs.size === 0) return {}
    const report = (node: TSESTree.Node, input: string | null) => {
      if (input && inputs.has(input)) context.report({ node, message: profileInputMessage(input) })
    }
    return {
      Program(node) {
        if (!file.endsWith('.vue')) return
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        const read = new Set<string>()
        walkVueTemplateAst(template, (templateNode) => {
          for (const input of templateProfileInputs(templateNode, inputs)) read.add(input)
        })
        for (const input of read) report(node, input)
      },
      MemberExpression(node) {
        report(node, fixedKey(node.property, node.computed))
      },
      Property(node) {
        if (node.parent.type === 'ObjectPattern') report(node, fixedKey(node.key, node.computed))
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

export {
  noZoomInSceneDrawing,
  noDirectGraphEmitterSubscriptions,
  noDirectOpenPencilBrowserStore,
  noDirectOpenPencilWindowInternals,
  noInlinePromptConstants,
  noDocumentChangeCapture,
  noEditorProfileInputs,
  noStructuredCloneSceneArrays,
  noDirectSelectionToolStateMutation
}
