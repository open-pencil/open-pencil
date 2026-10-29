import { describe, expect, test } from 'bun:test'

import { computeExportTransform } from '#fig/node-change/basics'
import {
  applyStyleRefsToFields,
  buildStyleOverrideTable,
  convertEffects,
  convertFills,
  convertFontFeatures,
  convertLetterSpacing,
  convertLineHeight,
  convertStrokes,
  decodeVectorNetworkBlob,
  encodePathCommandsBlob,
  encodeVectorNetworkBlob,
  mapTextDecoration,
  nodeChangeToProps,
  setVariableColorResolver
} from '#fig/node-change/index'
import { fillToKiwiPaint } from '#fig/node-change/paint'

import {
  getCompiledSchema,
  initCodec,
  type NodeChange,
  type Paint
} from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import TransformMatrix from '@open-pencil/scene-graph/matrix'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

describe('@open-pencil/fig NodeChange policy', () => {
  test('keeps raw LINE endpoints through reflected parents and exports authored origin pivots', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', graph.getPages()[0].id, {
      x: 10,
      y: 20,
      width: 200,
      height: 100,
      rotation: 90
    })
    for (const flip of [false, true]) {
      const raw: NodeChange = {
        type: 'LINE',
        size: { x: 100, y: 0 },
        transform: {
          m00: 0,
          m01: flip ? 1 : -1,
          m02: 200,
          m10: 1,
          m11: 0,
          m12: 300
        }
      }
      const line = graph.createNode('LINE', parent.id, nodeChangeToProps(raw, []))
      const points = TransformMatrix.mapPoints(getWorldMatrix(line, graph), [0, 0, 100, 0])
      for (const [i, expected] of [-140, 170, -240, 170].entries())
        expect(points[i]).toBeCloseTo(expected)
      const exported = computeExportTransform(line)
      for (const key of ['m00', 'm01', 'm02', 'm10', 'm11', 'm12'] as const)
        expect(exported[key]).toBeCloseTo(raw.transform?.[key] ?? 0)
    }
    const authored = graph.createNode('LINE', parent.id, {
      x: 30,
      y: 40,
      width: 80,
      height: 0,
      rotation: -90,
      flipX: true
    })
    const exported = computeExportTransform(authored)
    expect(exported.m02).toBe(110)
    expect(exported.m12).toBe(40)
    expect(exported.m01).toBeCloseTo(-1)
    expect(exported.m10).toBeCloseTo(-1)
    const rectangle = graph.createNode('RECTANGLE', parent.id, {
      x: 30,
      y: 40,
      width: 80,
      height: 20,
      rotation: 90
    })
    expect(computeExportTransform(rectangle)).toMatchObject({ m02: 80, m12: 10 })
  })

  test('exports a vertically flipped layer as the matrix that places it', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      x: 30,
      y: 40,
      width: 80,
      height: 20,
      rotation: 30,
      flipY: true
    })
    const exported = computeExportTransform(node)
    const corners = [0, 0, 80, 0, 80, 20, 0, 20]
    const expected = TransformMatrix.mapPoints(getWorldMatrix(node, graph), corners)
    const reimported = graph.createNode(
      'RECTANGLE',
      graph.getPages()[0].id,
      nodeChangeToProps({ type: 'RECTANGLE', size: { x: 80, y: 20 }, transform: exported }, [])
    )
    const actual = TransformMatrix.mapPoints(getWorldMatrix(reimported, graph), corners)
    for (const [i, value] of expected.entries()) expect(actual[i]).toBeCloseTo(value)
  })

  test('converts normalized text values', () => {
    // A percent stays one, and Figma's RAW multiplier is a percent too.
    expect(convertLineHeight({ value: 120, units: 'PERCENT' })).toEqual(percentLength(120))
    expect(convertLineHeight({ value: 1.5, units: 'RAW' })).toEqual(percentLength(150))
    expect(convertLineHeight({ value: 24, units: 'PIXELS' })).toEqual(pixelLength(24))
    expect(convertLetterSpacing({ value: 10, units: 'PERCENT' })).toEqual(percentLength(10))
    expect(mapTextDecoration('UNDERLINE')).toBe('UNDERLINE')
  })

  test('converts Figma OpenType feature toggles', () => {
    expect(
      convertFontFeatures({
        toggledOnOTFeatures: ['DLIG'],
        toggledOffOTFeatures: ['LIGA']
      })
    ).toEqual([
      { tag: 'DLIG', enabled: true },
      { tag: 'LIGA', enabled: false }
    ])
  })

  test('normalizes raw STRETCH to crop while exporting the actual Kiwi enum', async () => {
    await initCodec()
    const transform = { m00: 2, m01: 0, m02: -0.25, m10: 0, m11: 2, m12: 0.125 }
    const raw: Paint = { type: 'IMAGE', imageScaleMode: 'STRETCH', transform }
    const fill = convertFills([raw])[0]
    expect(fill.imageScaleMode).toBe('CROP')
    expect(fill.imageTransform).toEqual(transform)
    const paint = fillToKiwiPaint(fill)
    expect(paint.imageScaleMode).toBe('STRETCH')
    expect(paint.transform).toEqual(transform)
    const codec = getCompiledSchema()
    expect(() => codec.encodePaint({ ...raw, imageScaleMode: 'CROP' })).toThrow()
    expect(codec.encodePaint(paint)).toEqual(codec.encodePaint({ ...paint, ...raw }))
    expect(
      convertFills([{ type: 'IMAGE', imageScaleMode: 'STRETCH' }])[0].imageTransform
    ).toBeUndefined()
  })

  test('reads a Figma tile by its scale and rotation, not the transform Figma keeps from a crop', () => {
    // As Figma writes a Tile switched from a Crop: the old crop stays, and Figma ignores it.
    const crop = { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.5, m12: 0.25 }
    const tile = convertFills([
      { type: 'IMAGE', imageScaleMode: 'TILE', transform: crop, scale: 0.5, rotation: 90 }
    ])[0]
    expect(tile).toMatchObject({ imageScaleMode: 'TILE', scale: 0.5, imageRotation: 90 })
    expect(tile.imageTransform).toBeUndefined()
    expect(fillToKiwiPaint(tile)).toMatchObject({
      imageScaleMode: 'TILE',
      scale: 0.5,
      rotation: 90
    })
    const identity = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    const fill = convertFills([
      { type: 'IMAGE', imageScaleMode: 'FILL', transform: identity, rotation: 0 }
    ])[0]
    expect(fill.imageTransform).toBeUndefined()
    expect(fill.imageRotation).toBeUndefined()
  })

  test('normalizes imported paints and effects', () => {
    expect(convertFills([{ type: 'SOLID' }])[0]).toMatchObject({
      color: { r: 0, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    })
    expect(convertEffects([{ type: 'DROP_SHADOW' }])[0]).toMatchObject({
      type: 'DROP_SHADOW',
      radius: 0,
      visible: true
    })
  })

  test('preserves the translation of rotated and mirrored Figma instances', () => {
    const props = nodeChangeToProps(
      {
        type: 'INSTANCE',
        size: { x: 955, y: 95.99996185302734 },
        transform: {
          m00: -4.371139183945161e-8,
          m01: -1,
          m02: 2326,
          m10: -1,
          m11: 4.371139183945161e-8,
          m12: 2254
        }
      } as NodeChange,
      []
    )

    expect(props.rotation).toBeCloseTo(-90, 5)
    expect(props.flipX).toBe(true)
    expect(props.x).toBeCloseTo(1800.5, 4)
    expect(props.y).toBeCloseTo(1728.5, 4)
  })

  const reflectedTransforms: Array<{
    name: string
    transform: NonNullable<NodeChange['transform']>
    rotation: number
  }> = [
    {
      name: 'horizontal reflection',
      transform: { m00: -1, m01: 0, m02: 400, m10: 0, m11: 1, m12: 200 },
      rotation: 0
    },
    {
      name: 'vertical reflection represented as a rotated horizontal reflection',
      transform: { m00: 1, m01: 0, m02: 400, m10: 0, m11: -1, m12: 200 },
      rotation: 180
    },
    {
      name: 'negative quarter-turn reflection',
      transform: { m00: 0, m01: -1, m02: 400, m10: -1, m11: 0, m12: 200 },
      rotation: -90
    },
    {
      name: 'positive quarter-turn reflection',
      transform: { m00: 0, m01: 1, m02: 400, m10: 1, m11: 0, m12: 200 },
      rotation: 90
    }
  ]

  test.each(reflectedTransforms)('reconstructs $name matrices', ({ transform, rotation }) => {
    const width = 120
    const height = 80
    const props = nodeChangeToProps(
      { type: 'INSTANCE', size: { x: width, y: height }, transform } as NodeChange,
      []
    )

    expect(props.rotation).toBeCloseTo(rotation, 5)
    expect(props.flipX).toBe(true)

    const actualRotation = props.rotation ?? 0
    const x = props.x ?? 0
    const y = props.y ?? 0
    const radians = (actualRotation * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const centerX = width / 2
    const centerY = height / 2
    expect(-cos).toBeCloseTo(transform.m00, 5)
    expect(sin).toBeCloseTo(transform.m01, 5)
    expect(sin).toBeCloseTo(transform.m10, 5)
    expect(cos).toBeCloseTo(transform.m11, 5)
    expect(x + centerX - (-cos * centerX + sin * centerY)).toBeCloseTo(transform.m02, 5)
    expect(y + centerY - (sin * centerX + cos * centerY)).toBeCloseTo(transform.m12, 5)
  })

  test('saved Hug geometry uses the decomposed position for rotated and reflected containers', () => {
    const transforms = [
      { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      { m00: 0, m01: -1, m02: 60, m10: 1, m11: 0, m12: -20 },
      { m00: -1, m01: 0, m02: 80, m10: 0, m11: -1, m12: 40 },
      { m00: -1, m01: 0, m02: 80, m10: 0, m11: 1, m12: 0 },
      { m00: 1, m01: 0, m02: 0, m10: 0, m11: -1, m12: 40 }
    ]
    for (const transform of transforms) {
      const props = nodeChangeToProps(
        {
          type: 'FRAME',
          size: { x: 80, y: 40 },
          transform,
          stackMode: 'VERTICAL',
          stackPrimarySizing: 'RESIZE_TO_FIT',
          fillPaints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }]
        },
        []
      )
      expect(props.x).toBeCloseTo(0)
      expect(props.y).toBeCloseTo(0)
      expect(props.derivedLayout?.x).toBeCloseTo(0)
      expect(props.derivedLayout?.y).toBeCloseTo(0)
      expect(props.derivedLayout).toMatchObject({ width: 80, height: 40 })
    }
  })

  test('keeps resolved variable alpha in paint opacity', () => {
    setVariableColorResolver(() => ({ r: 1, g: 0, b: 0, a: 0.4 }))
    try {
      const paint: Paint = {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        colorVar: { value: { alias: { guid: { sessionID: 1, localID: 2 } } } }
      }
      expect(convertFills([paint])[0]).toMatchObject({
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 0.4
      })
      expect(convertStrokes([paint])[0]).toMatchObject({
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 0.4
      })
    } finally {
      setVariableColorResolver(null)
    }
  })

  test("carries a gradient stroke's stops and transform, not a black solid", () => {
    const paint: Paint = {
      type: 'GRADIENT_LINEAR',
      stops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
      ],
      transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    }
    const [stroke] = convertStrokes([paint], 2, 'OUTSIDE')

    expect(stroke.type).toBe('GRADIENT_LINEAR')
    expect(stroke.gradientStops?.map((stop) => stop.position)).toEqual([0, 1])
    expect(stroke.gradientStops?.[0].color).toMatchObject({ r: 1, g: 0, b: 0 })
    expect(stroke.gradientTransform).toMatchObject({ m00: 1, m11: 1 })
    expect(stroke).toMatchObject({ weight: 2, align: 'OUTSIDE' })
  })

  test("carries an image stroke's hash and scale mode", () => {
    const paint: Paint = { type: 'IMAGE', image: { hash: 'abc123' }, imageScaleMode: 'FIT' }
    const [stroke] = convertStrokes([paint], 1, 'INSIDE')

    expect(stroke.type).toBe('IMAGE')
    expect(stroke.imageHash).toBe('abc123')
    expect(stroke.imageScaleMode).toBe('FIT')
  })

  test('uses vector-region winding rules for rendered geometry', () => {
    const network = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' as const },
        { x: 10, y: 0, handleMirroring: 'NONE' as const },
        { x: 0, y: 10, handleMirroring: 'NONE' as const }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        },
        {
          start: 1,
          end: 2,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        },
        {
          start: 2,
          end: 0,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        }
      ],
      regions: [{ windingRule: 'EVENODD' as const, loops: [[0, 1, 2]] }]
    }
    const props = nodeChangeToProps(
      {
        type: 'VECTOR',
        fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: 0 }],
        vectorData: { vectorNetworkBlob: 1 }
      } as NodeChange,
      [
        encodePathCommandsBlob([
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 10, y: 0 },
          { type: 'L', x: 0, y: 10 },
          { type: 'Z' }
        ]),
        encodeVectorNetworkBlob(network)
      ]
    )

    expect(props.fillGeometry?.[0]?.windingRule).toBe('EVENODD')
  })

  test('round-trips vector network blobs with handle mirroring', () => {
    const network = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'ANGLE' as const },
        { x: 10, y: 0, handleMirroring: 'NONE' as const }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        }
      ],
      regions: []
    }
    const { table, styleToId } = buildStyleOverrideTable(network)
    expect(decodeVectorNetworkBlob(encodeVectorNetworkBlob(network, styleToId), table)).toEqual(
      network
    )
  })

  test('resolves imported style references before SceneGraph conversion', () => {
    const fields: Record<string, unknown> = {
      styleIdForFill: { guid: { sessionID: 2, localID: 3 } }
    }
    applyStyleRefsToFields(
      new Map([
        [
          '2:3',
          {
            type: 'RECTANGLE',
            styleType: 'FILL',
            fillPaints: [{ type: 'SOLID', visible: true }]
          }
        ]
      ]),
      fields
    )
    expect(fields.fillPaints).toEqual([{ type: 'SOLID', visible: true }])
  })
})

describe('one-ended arrow import', () => {
  test('a per-vertex arrow cap does not become the node-wide cap', () => {
    const network = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0, strokeCap: 'ARROW_EQUILATERAL' }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
    const { table, styleToId } = buildStyleOverrideTable(network)
    const props = nodeChangeToProps(
      {
        type: 'VECTOR',
        vectorData: { vectorNetworkBlob: 0, styleOverrideTable: table }
      } as NodeChange,
      [encodeVectorNetworkBlob(network, styleToId)]
    )

    expect(props.strokeCap).toBe('NONE')
    expect(props.vectorNetwork?.vertices[1].strokeCap).toBe('ARROW_EQUILATERAL')
    expect(props.vectorNetwork?.vertices[0].strokeCap).toBeUndefined()
  })
})
