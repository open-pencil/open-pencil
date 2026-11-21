import { expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange, VariableAnyValue } from '@open-pencil/kiwi/fig/codec'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { guid } from '@open-pencil/test-support/fig/guid'

import { readerSessionOptions, type FigReaderDiagnostic } from '#core/kiwi/fig/session/options'

/**
 * A `Color Scheme` collection with Light and Dark modes, a COLOR variable, and one PAINT
 * variable, as Apple's iOS and iPadOS 27 UI Kit has it: `Fill Variables/Alert/...`
 * variables whose `variableResolvedType` is PAINT, with a full paint (including its blend
 * mode) per mode. See https://github.com/open-pencil/open-pencil/issues/2261
 *
 * The pinned fig.kiwi schema predates PAINT variables, so a PAINT fixture cannot be
 * encoded into a `.fig` archive; these records are materialized directly, which is where
 * the reader session's options decide whether the document opens.
 */
/**
 * A paint value as Figma writes it; the codec does not model paint values yet. The
 * intersection keeps the per-mode paints Figma writes, which the importer never reads for
 * a type it cannot materialize.
 */
type PaintVariableValue = VariableAnyValue & {
  paintValue: {
    type: string
    color: Color
    opacity: number
    visible: boolean
    blendMode: string
  }
}

function paintValue(blendMode: string): PaintVariableValue {
  return {
    paintValue: {
      type: 'SOLID',
      color: { r: 0, g: 1, b: 0, a: 1 },
      opacity: 1,
      visible: true,
      blendMode
    }
  }
}

function paintVariableResources(): NodeChange[] {
  return [
    {
      guid: guid(3),
      type: 'VARIABLE_SET',
      name: 'Color Scheme',
      variableSetModes: [
        { id: guid(10), name: 'Light' },
        { id: guid(11), name: 'Dark' }
      ]
    },
    {
      guid: guid(4),
      type: 'VARIABLE',
      name: 'Accent',
      variableResolvedType: 'COLOR',
      variableSetID: { guid: guid(3) },
      variableDataValues: {
        entries: [
          {
            modeID: guid(10),
            variableData: {
              dataType: 'COLOR',
              value: { colorValue: { r: 0, g: 0, b: 1, a: 1 } }
            }
          },
          {
            modeID: guid(11),
            variableData: {
              dataType: 'COLOR',
              value: { colorValue: { r: 0, g: 0, b: 0.5, a: 1 } }
            }
          }
        ]
      }
    },
    {
      guid: guid(5),
      type: 'VARIABLE',
      name: 'Fill Variables/Alert/Button BG',
      variableResolvedType: 'PAINT',
      variableSetID: { guid: guid(3) },
      variableDataValues: {
        entries: [
          {
            modeID: guid(10),
            variableData: {
              dataType: 'PAINT',
              resolvedDataType: 'PAINT',
              value: paintValue('LINEAR_BURN')
            }
          },
          {
            modeID: guid(11),
            variableData: {
              dataType: 'PAINT',
              resolvedDataType: 'PAINT',
              value: paintValue('LINEAR_DODGE')
            }
          }
        ]
      }
    }
  ]
}

test('a strict read still rejects a PAINT variable instead of dropping it silently', () => {
  expect(() => materializeDocument(paintVariableResources())).toThrow(
    'Unsupported document resource VARIABLE'
  )
})

test('opening a file with a PAINT variable skips the variable and reports it', () => {
  const diagnostics: FigReaderDiagnostic[] = []
  const { graph } = materializeDocument(
    paintVariableResources(),
    [],
    readerSessionOptions(diagnostics)
  )
  const collection = graph.variableCollections.get('1:3')
  expect(collection?.modes.map((mode) => mode.name)).toEqual(['Light', 'Dark'])
  expect(collection?.variableIds).toEqual(['1:4'])
  expect(graph.variables.get('1:4')?.valuesByMode).toEqual({
    '1:10': { r: 0, g: 0, b: 1, a: 1 },
    '1:11': { r: 0, g: 0, b: 0.5, a: 1 }
  })
  expect(graph.variables.get('1:5')).toBeUndefined()
  const reported = diagnostics.filter((entry) => entry.kind === 'resource')
  expect(reported).toHaveLength(1)
  expect(reported[0]?.diagnostic).toMatchObject({
    type: 'VARIABLE',
    name: 'Fill Variables/Alert/Button BG',
    variableResolvedType: 'PAINT'
  })
})
