import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import {
  VUE_ELEMENT_NODE,
  hasUIHelperCall,
  isBoundStringLiteral,
  isStaticVueAttribute,
  isVueBindDirective,
  isVueSourceFile,
  vueSfcDescriptor,
  vueTemplateAst,
  walkVueTemplateAst
} from '#lint/support/vue.ts'
import { ElementTypes } from '@vue/compiler-core'

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
} satisfies RuleDefinition

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
            templateNode.type === VUE_ELEMENT_NODE &&
            templateNode.tagType === ElementTypes.ELEMENT &&
            templateNode.props.some(
              (prop) => isStaticVueAttribute(prop, 'title') || isVueBindDirective(prop, 'title')
            )
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
} satisfies RuleDefinition

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
} satisfies RuleDefinition

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
} satisfies RuleDefinition

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
          if (!hasTemplateUiHelperCall && hasUIHelperCall(templateNode)) {
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
} satisfies RuleDefinition

export {
  noHardcodedTipLabelsInVue,
  noNativeTitleAttributesInVue,
  noRawSvgInAppVueTemplates,
  noUiHelperCallsInVueTemplates,
  noVueStyleBlocks
}
