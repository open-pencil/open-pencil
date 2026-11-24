import { expect, test } from 'bun:test'

import { easingToCSS, timingToCSS, tokenStylesheet } from '@open-pencil/dom-css/export'
import { SceneGraph } from '@open-pencil/scene-graph'
import { easingPreset } from '@open-pencil/scene-graph/variables'
import { maxOf } from '@open-pencil/std/arrays'

test('a timing is written in milliseconds, without a file’s float noise, and with its unit at 0', () => {
  expect(timingToCSS(0.25)).toBe('250ms')
  expect(timingToCSS(Math.fround(0.2))).toBe('200ms')
  expect(timingToCSS(0.0005)).toBe('0.5ms')
  expect(timingToCSS(0)).toBe('0ms')
})

test('an easing is a keyword where CSS has one, else cubic-bezier(), a hold steps, and a spring is linear()', () => {
  expect(easingToCSS(easingPreset('EASE_IN'))).toBe('ease-in')
  expect(easingToCSS(easingPreset('INOUT_CUBIC'))).toBe('ease-in-out')
  expect(easingToCSS(easingPreset('OUT_BACK_CUBIC'))).toBe('cubic-bezier(0.45, 1.45, 0.8, 1)')
  expect(easingToCSS({ easing: 'HOLD' })).toBe('step-end')
  const spring = easingToCSS(easingPreset('GENTLE_SPRING'))
  expect(spring).toStartWith('linear(0, ')
  expect(spring).toEndWith(', 1)')
  // Gentle overshoots its target before it settles.
  expect(maxOf(spring.slice(7, -1).split(', ').map(Number))).toBeGreaterThan(1)
})

test('timings and easings become custom properties, easings named as Tailwind’s ease-*', async () => {
  const graph = new SceneGraph()
  const motion = graph.createCollection('Motion')
  graph.createVariable('Fast', 'TIMING', motion.id, 0.15)
  graph.createVariable('Out', 'EASING', motion.id, easingPreset('OUT_CUBIC'))
  graph.createVariable('Gentle', 'EASING', motion.id, easingPreset('GENTLE_SPRING'))

  const css = await tokenStylesheet(graph, { format: 'css' })
  expect(css.css).toContain('--fast: 150ms;')
  expect(css.css).toContain('--ease-out: ease-out;')
  expect(css.css).toContain('--ease-gentle: linear(0, ')
  expect(css.issues).toEqual([])

  const tailwind = await tokenStylesheet(graph, { format: 'tailwind' })
  expect(tailwind.css).toContain('--ease-out: ease-out;')
})
