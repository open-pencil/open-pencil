import { generate, parse, walk } from 'css-tree'

import { parseCSSColor } from '@open-pencil/scene-graph/css'

import type { KitTheme } from './kit'

/**
 * The custom properties a stylesheet declares on `:root`, as its theme: the ones whose value is
 * a color, in the order it declares them.
 */
export function kitTheme(stylesheet: string): KitTheme {
  const colors: string[] = []
  walk(parse(stylesheet), {
    visit: 'Rule',
    enter(rule) {
      if (generate(rule.prelude) !== ':root') return
      walk(rule.block, {
        visit: 'Declaration',
        enter(declaration) {
          const value = generate(declaration.value).trim()
          if (declaration.property.startsWith('--') && parseCSSColor(value))
            colors.push(declaration.property)
        }
      })
    }
  })
  return { colors }
}
