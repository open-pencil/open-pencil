import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'

import { graphOf } from '#core/figma-api/graph'
import type { FigmaEasing, FigmaEasingType } from '#core/figma-api/variables/easing'

// Expected values were recorded by running the same calls in Figma desktop.

function motion() {
  const api = createAPI()
  const collection = api.variables.createVariableCollection('Motion')
  const mode = collection.defaultModeId
  const timing = api.variables.createVariable('timing', collection, 'TIMING')
  const easing = api.variables.createVariable('easing', collection, 'EASING')
  return { api, collection, mode, timing, easing }
}

/** What Figma reads back after `setValueForMode` with only the type, as a preset is set. */
const PRESETS: Array<[FigmaEasingType, Omit<FigmaEasing, 'type'>]> = [
  ['EASE_IN', { easingFunctionCubicBezier: { x1: 0.42, y1: 0, x2: 1, y2: 1 } }],
  ['EASE_OUT', { easingFunctionCubicBezier: { x1: 0, y1: 0, x2: 0.58, y2: 1 } }],
  ['EASE_IN_AND_OUT', { easingFunctionCubicBezier: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } }],
  ['LINEAR', { easingFunctionCubicBezier: { x1: 0, y1: 0, x2: 1, y2: 1 } }],
  ['EASE_IN_BACK', { easingFunctionCubicBezier: { x1: 0.3, y1: -0.05, x2: 0.7, y2: -0.5 } }],
  ['EASE_OUT_BACK', { easingFunctionCubicBezier: { x1: 0.45, y1: 1.45, x2: 0.8, y2: 1 } }],
  ['EASE_IN_AND_OUT_BACK', { easingFunctionCubicBezier: { x1: 0.7, y1: -0.4, x2: 0.4, y2: 1.4 } }],
  ['GENTLE', { easingFunctionSpring: { bounce: 0.25 } }],
  ['QUICK', { easingFunctionSpring: { bounce: 0.42264973081037427 } }],
  ['BOUNCY', { easingFunctionSpring: { bounce: 0.6938137821521027 } }],
  ['SLOW', { easingFunctionSpring: { bounce: 0 } }],
  ['HOLD', {}]
]

describe('timing variables', () => {
  test('start at 0 and hold seconds', () => {
    const { mode, timing } = motion()
    expect(timing.resolvedType).toBe('TIMING')
    expect(timing.valuesByMode).toEqual({ [mode]: 0 })
    timing.setValueForMode(mode, 0.25)
    expect(timing.valuesByMode).toEqual({ [mode]: 0.25 })
  })

  test('refuse anything but a number or a timing alias', () => {
    const { api, collection, mode, timing } = motion()
    const message = `in setValueForMode: Mismatched variable resolved type for mode ${mode}`
    expect(() => timing.setValueForMode(mode, '250ms')).toThrow(message)
    const number = api.variables.createVariable('number', collection, 'FLOAT')
    expect(() => timing.setValueForMode(mode, api.variables.createVariableAlias(number))).toThrow(
      message
    )
    const other = api.variables.createVariable('other', collection, 'TIMING')
    timing.setValueForMode(mode, api.variables.createVariableAlias(other))
    expect(timing.valuesByMode[mode]).toEqual({ type: 'VARIABLE_ALIAS', id: other.id })
  })
})

describe('easing variables', () => {
  test('start as the curve Figma reads a new one back as', () => {
    const { api, mode, easing } = motion()
    expect(easing.valuesByMode).toEqual({
      [mode]: {
        type: 'CUSTOM_CUBIC_BEZIER',
        easingFunctionCubicBezier: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 }
      }
    })
    expect(graphOf(api).variables.get(easing.id)?.valuesByMode[mode]).toEqual({
      easing: 'IN_CUBIC'
    })
  })

  test('read each preset back with its own numbers', () => {
    const { mode, easing } = motion()
    for (const [type, numbers] of PRESETS) {
      easing.setValueForMode(mode, { type })
      expect(easing.valuesByMode[mode]).toEqual({ type, ...numbers })
    }
  })

  test('keep a custom curve, and a custom spring by its bounce', () => {
    const { api, mode, easing } = motion()
    const curve = { x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.9 }
    easing.setValueForMode(mode, { type: 'CUSTOM_CUBIC_BEZIER', easingFunctionCubicBezier: curve })
    expect(easing.valuesByMode[mode]).toEqual({
      type: 'CUSTOM_CUBIC_BEZIER',
      easingFunctionCubicBezier: curve
    })
    easing.setValueForMode(mode, { type: 'CUSTOM_SPRING', easingFunctionSpring: { bounce: 0.4 } })
    expect(easing.valuesByMode[mode]).toEqual({
      type: 'CUSTOM_SPRING',
      easingFunctionSpring: { bounce: 0.4 }
    })
    // Figma saves a spring set by its bounce at stiffness 100 and mass 1.
    expect(graphOf(api).variables.get(easing.id)?.valuesByMode[mode]).toEqual({
      easing: 'CUSTOM_SPRING',
      spring: { stiffness: 100, damping: 12, mass: 1 }
    })
  })

  test('refuse a value that is not an easing', () => {
    const { mode, easing } = motion()
    const message = `in setValueForMode: Mismatched variable resolved type for mode ${mode}`
    expect(() => easing.setValueForMode(mode, 0.25)).toThrow(message)
    // A value from a plugin is not checked by its types; the call checks it.
    const wobble: unknown = JSON.parse('{"type":"WOBBLE"}')
    expect(() => easing.setValueForMode(mode, wobble as FigmaEasing)).toThrow(message)
  })

  test('resolve for a layer as the API reads them', () => {
    const { api, mode, easing } = motion()
    easing.setValueForMode(mode, { type: 'GENTLE' })
    const frame = api.createFrame()
    expect(easing.resolveForConsumer(frame)).toEqual({
      value: { type: 'GENTLE', easingFunctionSpring: { bounce: 0.25 } },
      resolvedType: 'EASING'
    })
  })
})
