import { normalizedFilename } from '#lint/support/context.ts'
import type { RuleDefinition } from '#lint/support/types.ts'
import type { TSESTree } from '@typescript-eslint/utils'

import type { Color } from '@open-pencil/scene-graph/primitives'

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

export { noHardcodedColorConstants, noHandRolledColor }
