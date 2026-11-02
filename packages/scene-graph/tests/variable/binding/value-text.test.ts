import { expect, test } from 'bun:test'

import { variableText } from '@open-pencil/scene-graph/variables'

// What Figma desktop 126 showed for text bound to each float32 variable value.
const FIGMA_TEXT: Array<[number, string]> = [
  [16, '16'],
  [100000, '100000'],
  [12.5, '12.50'],
  [-0.5, '-0.50'],
  [0.3333333432674408, '0.33'],
  [0.6666666865348816, '0.67'],
  [0.10000000149011612, '0.10'],
  [0.30000001192092896, '0.30'],
  [1234567.875, '1234567.88'],
  [1.0000000116860974e-7, '0'],
  [9.999999974752427e-7, '0'],
  [-9.999999974752427e-7, '0'],
  [1.0999999631167157e-6, '0.00'],
  [-1.9999999494757503e-5, '-0.00'],
  [0.9999989867210388, '1.00'],
  [7.000010013580322, '7.00'],
  [0.9990000128746033, '1.00'],
  [-0.004000000189989805, '-0.00'],
  [0.125, '0.12'],
  [0.13500000536441803, '0.14'],
  [2.005000114440918, '2.01'],
  [99999.9921875, '99999.99'],
  [16777216, '16777216'],
  [1.0000000200408773e21, '2147483647'],
  [-3000000000, '-2147483648'],
  [-7.25, '-7.25'],
  // Measured on 2026-10-20: only values near zero round to a whole number.
  [2.000000238418579, '2.00'],
  [2.999999046325684, '3.00'],
  [7.000004291534424, '7.00']
]

test('a number bound to text reads as Figma writes it', () => {
  expect(FIGMA_TEXT.map(([value]) => variableText(value))).toEqual(
    FIGMA_TEXT.map(([, text]) => text)
  )
})

test('a string reads as it is, and a boolean as true or false', () => {
  expect([variableText('Hello'), variableText(true), variableText(false)]).toEqual([
    'Hello',
    'true',
    'false'
  ])
})
