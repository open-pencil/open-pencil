import { existsSync } from 'node:fs'

import { parse as parseVueSfc } from 'vue/compiler-sfc'

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

        const shape = props
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

function vueSfcDescriptor(source, filename) {
  return parseVueSfc(source, { filename }).descriptor
}

function vueTemplateAst(source, filename) {
  return vueSfcDescriptor(source, filename).template?.ast ?? null
}

function isVueSourceFile(file) {
  return (
    file.endsWith('.vue') &&
    (file.startsWith('src/') ||
      file.includes('/src/') ||
      file.startsWith('packages/vue/src/') ||
      file.includes('/packages/vue/src/'))
  )
}

function sourceLineCount(source) {
  const normalized = source.endsWith('\n') ? source.slice(0, -1) : source
  return normalized.split('\n').length
}

const VUE_ELEMENT_NODE = 1
const VUE_SIMPLE_EXPRESSION_NODE = 4
const VUE_INTERPOLATION_NODE = 5
const VUE_ATTRIBUTE_NODE = 6
const VUE_DIRECTIVE_NODE = 7

function walkVueTemplateAst(node, visitor) {
  visitor(node)
  for (const prop of node.props ?? []) walkVueTemplateAst(prop, visitor)
  for (const child of node.children ?? []) walkVueTemplateAst(child, visitor)
  if (node.type === VUE_INTERPOLATION_NODE && node.content) {
    walkVueTemplateAst(node.content, visitor)
  }
  if (node.type === VUE_DIRECTIVE_NODE) {
    if (node.arg) walkVueTemplateAst(node.arg, visitor)
    if (node.exp) walkVueTemplateAst(node.exp, visitor)
  }
}

function walkExpressionAst(node, visitor) {
  if (!node || typeof node !== 'object') return
  visitor(node)
  for (const value of Object.values(node)) {
    if (!value || value === node.loc) continue
    if (Array.isArray(value)) {
      for (const item of value) walkExpressionAst(item, visitor)
      continue
    }
    walkExpressionAst(value, visitor)
  }
}

function isUiHelperName(name) {
  const prefix = 'use'
  const suffix = 'UI'
  if (!name.startsWith(prefix) || !name.endsWith(suffix)) return false
  const firstDomainChar = name.at(prefix.length)
  return firstDomainChar !== undefined && firstDomainChar === firstDomainChar.toUpperCase()
}

function hasExpressionCall(expression, predicate) {
  if (expression?.type !== VUE_SIMPLE_EXPRESSION_NODE || !expression.ast) return false
  let found = false
  walkExpressionAst(expression.ast, (node) => {
    if (found || node.type !== 'CallExpression') return
    if (node.callee?.type === 'Identifier' && predicate(node.callee.name)) found = true
  })
  return found
}

function hasUiHelperCall(expression) {
  return hasExpressionCall(expression, isUiHelperName)
}

function isStaticVueAttribute(node, name) {
  return node.type === VUE_ATTRIBUTE_NODE && node.name === name
}

function isVueBindDirective(node, name) {
  return node.type === VUE_DIRECTIVE_NODE && node.name === 'bind' && node.arg?.content === name
}

function isBoundStringLiteral(node, name) {
  if (!isVueBindDirective(node, name)) return false
  const expression = node.exp
  if (expression?.type !== VUE_SIMPLE_EXPRESSION_NODE) return false
  const ast = expression.ast
  if (!ast) return false
  if (ast.type === 'StringLiteral' || (ast.type === 'Literal' && typeof ast.value === 'string')) {
    return true
  }
  return ast.type === 'TemplateLiteral' && ast.expressions?.length === 0
}

const noVueStyleBlocks = {
  meta: {
    docs: {
      description: 'Disallow Vue component <style> blocks — use Tailwind utilities or global tokens'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!isVueSourceFile(file)) return {}

    return {
      Program(node) {
        const descriptor = vueSfcDescriptor(context.sourceCode.getText(), file)
        if (descriptor.styles.length === 0) return
        context.report({
          node,
          message:
            'Vue components must not use <style> blocks. Use Tailwind utilities or global app.css tokens.'
        })
      }
    }
  }
}

const noNativeTitleAttributesInVue = {
  meta: {
    docs: {
      description: 'Disallow native title attributes in Vue components — use Tip/Reka tooltip'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!isVueSourceFile(file)) return {}

    return {
      Program(node) {
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        let hasTitleAttribute = false
        walkVueTemplateAst(template, (templateNode) => {
          if (hasTitleAttribute) return
          if (
            isStaticVueAttribute(templateNode, 'title') ||
            isVueBindDirective(templateNode, 'title')
          ) {
            hasTitleAttribute = true
          }
        })
        if (!hasTitleAttribute) return
        context.report({
          node,
          message: 'Use the shared tooltip UI instead of native title attributes.'
        })
      }
    }
  }
}

const noHardcodedTipLabelsInVue = {
  meta: {
    docs: {
      description: 'Disallow hardcoded Tip labels — use localized i18n messages'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!isVueSourceFile(file)) return {}

    return {
      Program(node) {
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        let hasHardcodedTipLabel = false
        walkVueTemplateAst(template, (templateNode) => {
          if (hasHardcodedTipLabel) return
          if (templateNode.type !== VUE_ELEMENT_NODE || templateNode.tag !== 'Tip') return
          hasHardcodedTipLabel = templateNode.props?.some(
            (prop) => isStaticVueAttribute(prop, 'label') || isBoundStringLiteral(prop, 'label')
          )
        })
        if (!hasHardcodedTipLabel) return
        context.report({
          node,
          message: 'Use a localized binding for Tip labels, not a hardcoded string.'
        })
      }
    }
  }
}

const noRawSvgInAppVueTemplates = {
  meta: {
    docs: {
      description: 'Disallow raw SVG in app Vue templates — use Iconify/unplugin icons'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!isVueSourceFile(file)) return {}

    return {
      Program(node) {
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        let hasRawSvg = false
        walkVueTemplateAst(template, (templateNode) => {
          if (templateNode.type === VUE_ELEMENT_NODE && templateNode.tag === 'svg') {
            hasRawSvg = true
          }
        })
        if (!hasRawSvg) return
        context.report({
          node,
          message: 'Use Iconify/unplugin icon components instead of raw <svg> in app templates.'
        })
      }
    }
  }
}

const noUiHelperCallsInVueTemplates = {
  meta: {
    docs: {
      description: 'Disallow use*UI() helper calls inside Vue templates'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue') || !file.includes('/src/components/')) return {}

    return {
      Program(node) {
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        let hasTemplateUiHelperCall = false
        walkVueTemplateAst(template, (templateNode) => {
          if (!hasTemplateUiHelperCall && hasUiHelperCall(templateNode)) {
            hasTemplateUiHelperCall = true
          }
        })
        if (!hasTemplateUiHelperCall) return
        context.report({
          node,
          message: 'Hoist use*UI() calls out of templates or hide them inside shared UI components.'
        })
      }
    }
  }
}

const PROPERTY_SECTION_LINE_ALLOWLIST = new Set([
  '/src/components/properties/LayoutSection/SizeControls.vue'
])

const noLargePropertySectionComponents = {
  meta: {
    docs: {
      description: 'Disallow oversized property-section Vue components'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue') || !file.includes('/src/components/properties/')) return {}
    if ([...PROPERTY_SECTION_LINE_ALLOWLIST].some((suffix) => file.endsWith(suffix))) return {}

    return {
      Program(node) {
        const lineCount = sourceLineCount(context.sourceCode.getText())
        if (lineCount <= 250) return
        context.report({
          node,
          message:
            'Split property-section components over 250 lines into focused controls or document an explicit allowlist.'
        })
      }
    }
  }
}

const TEST_ID_FORMAT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

const noRawTestIdStringProps = {
  meta: {
    docs: {
      description:
        'Disallow test-id component props — use data-test-id attrs or internal semantic ids'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.endsWith('.vue')) return {}

    function isTestIdKey(key) {
      if (key?.type !== 'Identifier') return false
      return key.name === 'testId' || /TestId$/u.test(key.name)
    }

    return {
      TSPropertySignature(node) {
        if (!isTestIdKey(node.key)) return
        context.report({
          node,
          message:
            'Do not expose test-id component props. Let callers pass data-test-id attrs or derive internal ids from semantic component state.'
        })
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
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        let hasDynamicDataTestId = false
        walkVueTemplateAst(template, (templateNode) => {
          if (hasDynamicDataTestId) return
          if (isVueBindDirective(templateNode, 'data-test-id')) hasDynamicDataTestId = true
        })
        if (!hasDynamicDataTestId) return
        context.report({
          node,
          message: 'Use v-test-id for dynamic/configurable test ids instead of :data-test-id.'
        })
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
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        let hasTestIdHelperBind = false
        walkVueTemplateAst(template, (templateNode) => {
          if (hasTestIdHelperBind) return
          if (templateNode.type !== VUE_DIRECTIVE_NODE || templateNode.name !== 'bind') return
          if (templateNode.arg) return
          hasTestIdHelperBind = hasExpressionCall(
            templateNode.exp,
            (name) => name === 'testId' || name === 'testIdAttr'
          )
        })
        if (!hasTestIdHelperBind) return
        context.report({
          node,
          message: 'Use v-test-id instead of v-bind="testId(...)" in Vue templates.'
        })
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
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        let invalidId = null
        let hasInvalidSpelling = false
        walkVueTemplateAst(template, (templateNode) => {
          if (hasInvalidSpelling || invalidId !== null) return
          if (
            isStaticVueAttribute(templateNode, 'data-testid') ||
            isVueBindDirective(templateNode, 'data-testid') ||
            isStaticVueAttribute(templateNode, 'test-id') ||
            isVueBindDirective(templateNode, 'test-id')
          ) {
            hasInvalidSpelling = true
            return
          }
          if (!isStaticVueAttribute(templateNode, 'data-test-id')) return
          const id = templateNode.value?.content ?? ''
          if (!TEST_ID_FORMAT.test(id)) invalidId = id
        })
        if (hasInvalidSpelling) {
          context.report({
            node,
            message: 'Use data-test-id attrs instead of data-testid or test-id component props.'
          })
          return
        }
        if (invalidId === null) return
        context.report({
          node,
          message: `Static data-test-id values must be kebab-case. Invalid id: "${invalidId}".`
        })
      }
    }
  }
}

const noRawTestIdSelectorsInTests = {
  meta: {
    docs: {
      description: 'Disallow raw data-test-id CSS selectors in Playwright tests — use getByTestId()'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!file.includes('/tests/')) return {}

    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee?.type !== 'MemberExpression') return
        if (callee.property?.type !== 'Identifier' || callee.property.name !== 'locator') return
        const firstArg = node.arguments?.[0]
        if (!firstArg) return

        const isRawTestIdSelector =
          (firstArg.type === 'Literal' &&
            typeof firstArg.value === 'string' &&
            firstArg.value.includes('[data-test-id')) ||
          (firstArg.type === 'TemplateLiteral' &&
            firstArg.quasis?.some((part) => part.value.raw.includes('[data-test-id')))

        if (!isRawTestIdSelector) return
        context.report({
          node,
          message: 'Use getByTestId() instead of raw [data-test-id] CSS selectors in tests.'
        })
      }
    }
  }
}

function isGeneratedTestIdLiteral(value) {
  if (typeof value !== 'string') return false
  const toolbarValue = value.startsWith('mobile-toolbar-') ? value.slice('mobile-'.length) : value
  return (
    toolbarValue.startsWith('toolbar-tool-') ||
    toolbarValue.startsWith('toolbar-flyout-') ||
    toolbarValue.startsWith('toolbar-flyout-item-') ||
    value === 'variables-add-float' ||
    value === 'variables-add-string' ||
    value === 'variables-add-boolean' ||
    value.startsWith('acp-permission-option-')
  )
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

    function report(node) {
      context.report({
        node,
        message:
          'Use shared generated test-id helpers instead of hand-written toolbar/variable/permission id literals.'
      })
    }

    return {
      Program(node) {
        if (!file.endsWith('.vue')) return
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        let hasGeneratedTemplateId = false
        walkVueTemplateAst(template, (templateNode) => {
          if (hasGeneratedTemplateId || !isStaticVueAttribute(templateNode, 'data-test-id')) return
          hasGeneratedTemplateId = isGeneratedTestIdLiteral(templateNode.value?.content)
        })
        if (hasGeneratedTemplateId) report(node)
      },
      Literal(node) {
        if (isGeneratedTestIdLiteral(node.value)) report(node)
      },
      TemplateElement(node) {
        if (isGeneratedTestIdLiteral(node.value?.raw)) report(node)
      }
    }
  }
}

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

function isNumericLiteral(node, value) {
  return node?.type === 'Literal' && node.value === value
}

function colorObjectLiteral(node, color) {
  if (node?.type !== 'ObjectExpression') return false
  const props = new Map()
  for (const prop of node.properties ?? []) {
    if (prop.type !== 'Property') return false
    const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
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
      '/src/app/cache/index.ts',
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

const componentNamespaceCasing = {
  meta: {
    docs: {
      description: 'Require component namespace folders to use the project casing convention'
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

        if (parts.length > 1 && !isPascalCaseName(first) && !isKebabOrLowercaseName(first)) {
          context.report({
            node,
            message: `Component namespace folder '${first}' must use PascalCase or kebab-case.`
          })
          return
        }

        if (
          parts.length > 2 &&
          (first === 'chat' || first === 'properties') &&
          second !== undefined &&
          !isPascalCaseName(second) &&
          !isKebabOrLowercaseName(second)
        ) {
          context.report({
            node,
            message: `Nested component namespace folder '${first}/${second}' must use PascalCase or kebab-case.`
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
          message:
            'Use window.openPencil.getStore() instead of accessing window.openPencil.store directly.'
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
  description: 'Disallow files that repeat an existing sibling domain folder in the filename',
  check(file) {
    const match = file.match(/^(.*\/)([^/]+)\.(?:test\.)?(?:spec\.)?(?:ts|tsx|vue)$/)
    if (!match) return false

    const [, dir, name] = match
    const parts = name.split('-')
    if (parts.length < 2) return false

    const prefix = parts[0]
    const suffix = parts.at(-1)
    const domain = existsSync(`${dir}${prefix}`)
      ? prefix
      : suffix && existsSync(`${dir}${suffix}`)
        ? suffix
        : null
    if (!domain) return false

    const filename = file.slice(dir.length)
    return `Move '${filename}' under the existing '${domain}/' folder instead of repeating the domain in the filename.`
  }
})

function typeParameterNodes(node) {
  return node?.typeParameters?.params ?? node?.typeArguments?.params ?? []
}

function isRecordStringUnknownType(node) {
  if (node?.type !== 'TSTypeReference') return false
  if (node.typeName?.type !== 'Identifier' || node.typeName.name !== 'Record') return false
  const params = typeParameterNodes(node)
  return params[0]?.type === 'TSStringKeyword' && params[1]?.type === 'TSUnknownKeyword'
}

function hasAstChild(node, predicate, seen = new WeakSet()) {
  if (!node || typeof node !== 'object') return false
  if (seen.has(node)) return false
  seen.add(node)
  if (predicate(node)) return true

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'range' || key === 'loc') continue
    if (Array.isArray(value)) {
      if (value.some((child) => hasAstChild(child, predicate, seen))) return true
    } else if (value && typeof value === 'object' && hasAstChild(value, predicate, seen)) {
      return true
    }
  }
  return false
}

function containsRecordStringUnknownType(node) {
  if (isRecordStringUnknownType(node)) return true
  if (node?.type === 'TSArrayType') return isRecordStringUnknownType(node.elementType)
  if (node?.type === 'TSUnionType')
    return node.types?.some(containsRecordStringUnknownType) ?? false
  return false
}

function isUnknownArrayType(node) {
  return node?.type === 'TSArrayType' && node.elementType?.type === 'TSUnknownKeyword'
}

function hasInlineUnknownArrayProperty(node) {
  if (node?.type !== 'TSTypeLiteral') return false
  return (node.members ?? []).some((member) => {
    const typeNode = member.typeAnnotation?.typeAnnotation
    return isUnknownArrayType(typeNode)
  })
}

function containsInlineUnknownObjectType(node) {
  return hasAstChild(node, hasInlineUnknownArrayProperty)
}

const noBroadUnknownTypeAssertions = {
  meta: {
    docs: {
      description:
        'Disallow broad unknown object type assertions. Add a named domain type or a type guard instead.'
    }
  },
  create(context) {
    function check(node) {
      if (containsRecordStringUnknownType(node.typeAnnotation)) {
        context.report({
          node,
          message:
            'Do not cast to Record<string, unknown>. Add a named domain type or a type guard.'
        })
        return
      }
      if (containsInlineUnknownObjectType(node.typeAnnotation)) {
        context.report({
          node,
          message: 'Do not cast to an inline unknown object shape. Add a named domain type.'
        })
      }
    }

    return {
      TSAsExpression: check,
      TSTypeAssertion: check
    }
  }
}

function typeNameText(node) {
  if (!node) return 'unknown'
  if (node.type === 'Identifier') return node.name
  if (node.type === 'TSQualifiedName')
    return `${typeNameText(node.left)}.${typeNameText(node.right)}`
  return node.type
}

function canonicalType(node) {
  if (!node) return 'unknown'
  switch (node.type) {
    case 'TSStringKeyword':
      return 'string'
    case 'TSNumberKeyword':
      return 'number'
    case 'TSBooleanKeyword':
      return 'boolean'
    case 'TSUnknownKeyword':
      return 'unknown'
    case 'TSNullKeyword':
      return 'null'
    case 'TSUndefinedKeyword':
      return 'undefined'
    case 'TSLiteralType':
      return `literal:${node.literal?.value ?? node.literal?.type}`
    case 'TSArrayType':
      return `array<${canonicalType(node.elementType)}>`
    case 'TSTypeReference': {
      const params = typeParameterNodes(node).map(canonicalType).join(',')
      return `ref:${typeNameText(node.typeName)}<${params}>`
    }
    case 'TSUnionType':
      return `union<${node.types.map(canonicalType).sort().join('|')}>`
    case 'TSTypeLiteral':
      return `object{${canonicalMembers(node.members)}}`
    case 'TSParenthesizedType':
      return canonicalType(node.typeAnnotation)
    case 'TSFunctionType':
      return 'function'
    default:
      return node.type
  }
}

function propertyKeyName(key) {
  if (key?.type === 'Identifier') return key.name
  if (key?.type === 'Literal') return String(key.value)
  return null
}

function canonicalMember(member) {
  if (member.type === 'TSIndexSignature') {
    const param = member.parameters?.[0]
    const keyType = param?.typeAnnotation?.typeAnnotation
    return `index:${canonicalType(keyType)}:${canonicalType(member.typeAnnotation?.typeAnnotation)}`
  }
  if (member.type !== 'TSPropertySignature') return null
  const name = propertyKeyName(member.key)
  if (!name) return null
  const optional = member.optional ? '?' : ''
  return `prop:${name}${optional}:${canonicalType(member.typeAnnotation?.typeAnnotation)}`
}

function canonicalMembers(members) {
  return (members ?? []).map(canonicalMember).filter(Boolean).sort().join(';')
}

function namedTypeShape(node) {
  if (node.type === 'TSInterfaceDeclaration') return canonicalMembers(node.body?.body)
  if (node.type === 'TSTypeAliasDeclaration' && node.typeAnnotation?.type === 'TSTypeLiteral') {
    return canonicalMembers(node.typeAnnotation.members)
  }
  return null
}

const noDuplicateTypeShapes = {
  meta: {
    docs: {
      description: 'Disallow duplicate local object type/interface shapes in one file'
    }
  },
  create(context) {
    const seen = new Map()
    return {
      'TSInterfaceDeclaration, TSTypeAliasDeclaration'(node) {
        const shape = namedTypeShape(node)
        if (!shape) return
        const memberCount = shape ? shape.split(';').filter(Boolean).length : 0
        if (memberCount < 2) return
        const first = seen.get(shape)
        if (!first) {
          seen.set(shape, node)
          return
        }
        context.report({
          node,
          message:
            'Duplicate object type shape. Reuse the existing named type instead of redeclaring the same members.'
        })
      }
    }
  }
}

const noLocalJsonObjectAliases = {
  meta: {
    docs: {
      description: 'Disallow local JsonObject aliases — import the shared type instead'
    }
  },
  create(context) {
    return {
      TSTypeAliasDeclaration(node) {
        if (node.id?.name !== 'JsonObject') return
        if (!isRecordStringUnknownType(node.typeAnnotation)) return
        context.report({
          node,
          message:
            'Import JsonObject from @open-pencil/scene-graph/primitives instead of declaring a local alias.'
        })
      }
    }
  }
}

const noImportTypeAnnotations = {
  meta: {
    docs: {
      description: 'Disallow inline import() type annotations — use top-level import type instead'
    }
  },
  create(context) {
    return {
      TSImportType(node) {
        context.report({
          node,
          message:
            'Use a top-level import type instead of an inline import() type annotation. Dynamic imports are only for runtime lazy loading.'
        })
      }
    }
  }
}

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
    'no-flat-kiwi-modules': noFlatKiwiModules,
    'no-top-level-prefixed-test-files': noTopLevelPrefixedTestFiles,
    'no-sibling-domain-prefixed-files': noSiblingDomainPrefixedFiles
  }
}

export default plugin
