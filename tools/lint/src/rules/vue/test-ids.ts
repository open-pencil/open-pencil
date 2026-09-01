import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import type { VueTemplateNode } from '#lint/support/vue.ts'
import {
  VUE_DIRECTIVE_NODE,
  hasExpressionCall,
  isStaticVueAttribute,
  isVueBindDirective,
  vueTemplateAst,
  walkVueTemplateAst
} from '#lint/support/vue.ts'
import type { TSESTree } from '@typescript-eslint/utils'

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

    function isTestIdKey(key: TSESTree.PropertyName): boolean {
      if (key?.type !== 'Identifier') return false
      return key.name === 'testId' || key.name.endsWith('TestId')
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
} satisfies RuleDefinition

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
} satisfies RuleDefinition

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
} satisfies RuleDefinition

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
        let invalidId: string | null = null
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
          const id = staticVueAttributeValue(templateNode, 'data-test-id')
          if (id === null) return
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
} satisfies RuleDefinition

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
} satisfies RuleDefinition

function staticVueAttributeValue(node: VueTemplateNode, name: string): string | null {
  if (!isStaticVueAttribute(node, name)) return null
  return node.value?.content ?? ''
}

function isGeneratedTestIdLiteral(value: unknown): boolean {
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

    function report(node: TSESTree.Node) {
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
} satisfies RuleDefinition

export {
  noDynamicDataTestIdInVue,
  noGeneratedTestIdLiterals,
  noInvalidTestIdAttributes,
  noRawTestIdSelectorsInTests,
  noRawTestIdStringProps,
  noTestIdHelperBindInVue
}
