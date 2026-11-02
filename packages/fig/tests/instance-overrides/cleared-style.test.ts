import { describe, expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { STYLE_GOVERNED_FIELDS } from '#fig/instance-overrides/cleared-style'
import { CLEARED_STYLE, SCENE_OVERRIDE_FIELDS } from '#fig/instance-overrides/fields'
import { interpretInstance } from '#fig/instance-overrides/interpret'
import { staleFigmaRawFields } from '#fig/source-metadata'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneNode, SharedStyleKind } from '@open-pencil/scene-graph'
import { SHARED_STYLE_FIELDS, sharedStyleRefKey } from '@open-pencil/scene-graph/shared-styles'

const solid = (r: number, g: number, b: number): NodeChange['fillPaints'] => [
  { type: 'SOLID', color: { r, g, b, a: 1 }, opacity: 1, visible: true }
]
const STYLE = { guid: guid(9) }

type Fields = Partial<NodeChange>

interface Kind {
  reference: keyof typeof STYLE_GOVERNED_FIELDS
  source: Fields
  middle: Fields
}

/**
 * Per style kind: the source layer's own values, and the values an intermediate component's style
 * gives it. Figma draws the source values once an outer instance clears the style.
 */
const KINDS: Kind[] = [
  {
    reference: 'styleIdForFill',
    source: { fillPaints: solid(0.1, 0.1, 0.1) },
    middle: { fillPaints: solid(1, 1, 1) }
  },
  {
    reference: 'styleIdForStrokeFill',
    source: { strokePaints: solid(1, 0, 0) },
    middle: { strokePaints: solid(0, 0, 1) }
  },
  {
    reference: 'styleIdForEffect',
    source: { effects: [{ type: 'FOREGROUND_BLUR', radius: 2, visible: true }] },
    middle: { effects: [{ type: 'DROP_SHADOW', radius: 8, visible: true }] }
  },
  {
    reference: 'styleIdForGrid',
    source: { layoutGrids: [{ pattern: 'GRID', sectionSize: 10, visible: true }] },
    middle: { layoutGrids: [{ pattern: 'STRIPES', numSections: 3, visible: true }] }
  },
  {
    reference: 'styleIdForText',
    source: {
      fontSize: 12,
      fontName: { family: 'Inter', style: 'Regular', postscript: '' },
      textCase: 'ORIGINAL',
      textTracking: 0
    },
    middle: {
      fontSize: 40,
      fontName: { family: 'Inter', style: 'Bold', postscript: '' },
      textCase: 'UPPER',
      textTracking: 0.05
    }
  }
]

/** Inner's layer, Middle's instance of Inner overriding it, and Outer's instance of Middle. */
function nested(source: Fields, middle: Fields, outer?: Fields): NodeChange[] {
  return [
    { guid: guid(1), type: 'SYMBOL', name: 'Inner' },
    { guid: guid(2), type: 'TEXT', parentIndex: { guid: guid(1), position: '!' }, ...source },
    { guid: guid(3), type: 'SYMBOL', name: 'Middle' },
    {
      guid: guid(4),
      type: 'INSTANCE',
      parentIndex: { guid: guid(3), position: '!' },
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [{ guidPath: { guids: [guid(2)] }, ...middle }]
      }
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(3),
        symbolOverrides: outer ? [{ guidPath: { guids: [guid(4), guid(2)] }, ...outer }] : []
      }
    }
  ] as NodeChange[]
}

const layerOf = (changes: NodeChange[]) =>
  interpretInstance(changes, '1:5').children[0].children[0].properties

describe.each(KINDS)(
  'an outer instance that clears $reference',
  ({ reference, source, middle }) => {
    const styled = { [reference]: STYLE, ...middle }
    const cleared = { [reference]: CLEARED_STYLE }

    test("shows the source layer's values for the fields its claim leaves out", () => {
      const layer = layerOf(nested(source, styled, cleared))
      expect(layer).toMatchObject({ ...source, ...cleared })
    })

    test('keeps the values its claim carries', () => {
      const layer = layerOf(nested(source, styled, { ...cleared, ...middle }))
      expect(layer).toMatchObject({ ...middle, ...cleared })
    })

    test("clears the source layer's own style too", () => {
      const layer = layerOf(nested({ ...source, [reference]: { guid: guid(8) } }, styled, cleared))
      expect(layer).toMatchObject({ ...source, ...cleared })
    })
  }
)

test('without the clear the intermediate component applies', () => {
  const [fill] = KINDS
  const layer = layerOf(nested(fill.source, { styleIdForFill: STYLE, ...fill.middle }))
  expect(layer).toMatchObject(fill.middle)
})

test("a cleared text style resets the text's paragraph and list spacing too", () => {
  const source: Fields = { paragraphSpacing: 0, paragraphIndent: 0, listSpacing: 0 }
  const middle: Fields = {
    styleIdForText: STYLE,
    paragraphSpacing: 24,
    paragraphIndent: 10,
    listSpacing: 8
  }
  const layer = layerOf(nested(source, middle, { styleIdForText: CLEARED_STYLE }))
  expect(layer).toMatchObject(source)
})

test("a governed field the source layer leaves out takes Figma's default, or goes away", () => {
  const middle: Partial<NodeChange> = {
    styleIdForText: STYLE,
    textCase: 'UPPER',
    textTracking: 0.05
  }
  const layer = layerOf(nested({}, middle, { styleIdForText: CLEARED_STYLE }))
  expect(layer.textCase).toBe('ORIGINAL')
  expect(layer).not.toHaveProperty('textTracking')
})

/** The raw fields a scene field is claimed as or saved in. */
/** Layout and geometry Figma derives from the fields, which a cleared style leaves to be derived. */
const DERIVED_RAW_FIELDS = new Set([
  'textData',
  'derivedTextData',
  'textUserLayoutVersion',
  'textExplicitLayoutVersion',
  'strokeGeometry',
  'vectorData'
])

const rawFieldsOf = (field: keyof SceneNode) => [
  ...(SCENE_OVERRIDE_FIELDS.get(field)?.map(({ raw }) => raw) ?? []),
  ...staleFigmaRawFields([field])
]

describe.each(Object.entries(SHARED_STYLE_FIELDS))(
  'the raw fields of a %s style',
  (kind, fields) => {
    const [reference] = staleFigmaRawFields([sharedStyleRefKey(kind as SharedStyleKind)])
    const governed: readonly string[] = STYLE_GOVERNED_FIELDS[reference as Kind['reference']]

    test('hold every raw field of each field the style gives, but derived data', () => {
      const own = fields.flatMap(rawFieldsOf).filter((raw) => !DERIVED_RAW_FIELDS.has(raw))
      expect(own.filter((raw) => !governed.includes(raw))).toEqual([])
    })

    test('hold nothing else', () => {
      const raw = new Set(fields.flatMap(rawFieldsOf))
      expect(governed.filter((field) => !raw.has(field))).toEqual([])
    })
  }
)
