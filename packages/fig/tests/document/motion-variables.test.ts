import { expect, test } from 'bun:test'

import { materializeDocument } from '#fig/document/materialize'

import type { NodeChange, VariableDataEntry } from '@open-pencil/kiwi/fig/codec'
import { guid } from '@open-pencil/test-support/fig/guid'

const LIGHT = guid(10)
const DARK = guid(11)

function variable(
  localID: number,
  name: string,
  type: string,
  light: VariableDataEntry,
  dark: VariableDataEntry
): NodeChange {
  return {
    guid: guid(localID),
    type: 'VARIABLE',
    name,
    variableResolvedType: type,
    variableSetID: { guid: guid(3) },
    variableDataValues: {
      entries: [
        { modeID: LIGHT, variableData: light },
        { modeID: DARK, variableData: dark }
      ]
    }
  }
}

const easing = (easingValue: NonNullable<VariableDataEntry['value']>['easingValue']) => ({
  value: { easingValue },
  dataType: 'EASING',
  resolvedDataType: 'EASING'
})
const seconds = (floatValue: number) => ({
  value: { floatValue },
  dataType: 'FLOAT',
  resolvedDataType: 'TIMING'
})

/** Timing and easing variables as Figma saves them, numbers as it writes them. */
function records(): NodeChange[] {
  return [
    {
      guid: guid(3),
      type: 'VARIABLE_SET',
      name: 'Motion',
      variableSetModes: [
        { id: LIGHT, name: 'Mode 1', sortPosition: '!' },
        { id: DARK, name: 'Dark', sortPosition: '"' }
      ]
    },
    variable(4, 'timing', 'TIMING', seconds(0.25), seconds(1.5)),
    variable(
      5,
      'timing alias',
      'TIMING',
      { value: { alias: { guid: guid(4) } }, dataType: 'ALIAS', resolvedDataType: 'TIMING' },
      seconds(0)
    ),
    variable(
      6,
      'easing',
      'EASING',
      easing({
        easingType: 'EASE_IN',
        easingValue: { bezierEasing: { p1x: 0.41999998688697815, p1y: 0, p2x: 1, p2y: 1 } }
      }),
      easing({
        easingType: 'CUSTOM_SPRING',
        easingValue: { springEasing: { stiffness: 100, damping: 12, mass: 1 } }
      })
    ),
    variable(
      7,
      'new easing',
      'EASING',
      easing({ easingType: 'IN_CUBIC' }),
      easing({ easingType: 'HOLD' })
    )
  ]
}

test('timing variables read as seconds, aliases included', () => {
  const { graph } = materializeDocument(records())
  expect(graph.variables.get('1:4')).toMatchObject({
    type: 'TIMING',
    valuesByMode: { '1:10': 0.25, '1:11': 1.5 }
  })
  expect(graph.variables.get('1:5')?.valuesByMode).toEqual({
    '1:10': { aliasId: '1:4' },
    '1:11': 0
  })
  expect(graph.resolveVariable('1:5', '1:10')).toBe(0.25)
})

test('easing variables read as their curve or spring and the numbers saved with it', () => {
  const { graph } = materializeDocument(records())
  expect(graph.variables.get('1:6')?.valuesByMode).toEqual({
    '1:10': { easing: 'EASE_IN', bezier: { x1: 0.41999998688697815, y1: 0, x2: 1, y2: 1 } },
    '1:11': { easing: 'CUSTOM_SPRING', spring: { stiffness: 100, damping: 12, mass: 1 } }
  })
  expect(graph.variables.get('1:7')?.valuesByMode).toEqual({
    '1:10': { easing: 'IN_CUBIC' },
    '1:11': { easing: 'HOLD' }
  })
})

test('an easing of a kind OpenPencil does not know is reported, not invented', () => {
  const reported: NodeChange[] = []
  const unknown = variable(
    8,
    'future',
    'EASING',
    easing({ easingType: 'WOBBLE' }),
    easing({ easingType: 'HOLD' })
  )
  const { graph } = materializeDocument([...records(), unknown], [], {
    onUnsupportedResource: (resource) => reported.push(resource)
  })
  expect(graph.variables.has('1:8')).toBe(false)
  expect(reported.map((resource) => resource.name)).toEqual(['future'])
})
