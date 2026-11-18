import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import {
  VUE_ELEMENT_NODE,
  isVueSourceFile,
  vueTemplateAst,
  walkVueTemplateAst
} from '#lint/support/vue.ts'

/** Icons that point left or right: by Lucide name in templates, or imported as components. */
const DIRECTIONAL_ICON =
  /^(?:icon-lucide-(?:chevrons?|arrow|panel)-(?:left|right)|Icon(?:Chevrons?|Arrow|Panel)(?:Left|Right))$/
const DIRECTIONS = new Set(['reading', 'physical'])

/** Sources the interface's direction mirrors: the app and the SDK's primitives. */
const INTERFACE_SOURCES = ['src/', 'packages/vue/src/']

/**
 * Require every left- or right-pointing icon to say which way it points in a mirrored interface:
 * `data-direction="reading"` turns it around in right to left (back, next, a submenu, a
 * disclosure), `data-direction="physical"` keeps it (a canvas side, a padding edge, an arrow end).
 */
export const iconDirection = {
  meta: {
    docs: {
      description:
        'Require left- and right-pointing icons to declare data-direction="reading" or "physical"'
    }
  },
  create(context) {
    const file = normalizedFilename(context)
    if (!isVueSourceFile(file)) return {}
    if (!INTERFACE_SOURCES.some((root) => file.startsWith(root) || file.includes(`/${root}`)))
      return {}

    return {
      Program(node) {
        const template = vueTemplateAst(context.sourceCode.getText(), file)
        if (!template) return
        walkVueTemplateAst(template, (templateNode) => {
          if (templateNode.type !== VUE_ELEMENT_NODE || !DIRECTIONAL_ICON.test(templateNode.tag))
            return
          const declared = templateNode.props.find(
            (prop) => prop.type === 6 && prop.name === 'data-direction'
          )
          const value = declared?.type === 6 ? declared.value?.content : undefined
          if (value && DIRECTIONS.has(value)) return
          context.report({
            node,
            message: `<${templateNode.tag}> on line ${templateNode.loc.start.line} needs data-direction="reading" (turns around in a right-to-left interface) or data-direction="physical" (keeps pointing the same way).`
          })
        })
      }
    }
  }
} satisfies RuleDefinition
