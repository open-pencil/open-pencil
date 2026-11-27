import { beforeAll, describe, expect, test } from 'bun:test'

import { deflateSync } from 'fflate'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer, writeFigArchive } from '@open-pencil/fig'
import {
  getCompiledSchema,
  getSchemaBytes,
  initCodec,
  type NodeChange,
  type Paint
} from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { guid } from '@open-pencil/test-support/fig/guid'
import {
  SHADER_ASSET,
  shaderDefinitionRecords
} from '@open-pencil/test-support/fig/shader-definition'
import { collectAllNodes } from '@open-pencil/test-support/fig/traversal'

const SOLID: Paint = {
  type: 'SOLID',
  color: { r: 0.2, g: 0.6, b: 0.4, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
}

const ASSIGNMENTS = [
  {
    defID: { sessionID: 7, localID: 8 },
    varValue: { value: { floatValue: 0.25 }, dataType: 'FLOAT', resolvedDataType: 'FLOAT' }
  },
  {
    defID: { sessionID: 7, localID: 9 },
    varValue: {
      value: { colorValue: { r: 1, g: 1, b: 1, a: 0.5 } },
      dataType: 'COLOR',
      resolvedDataType: 'COLOR'
    }
  }
]

const LIBRARY_SHADER: Paint = {
  type: 'CUSTOM',
  opacity: 0.5,
  visible: true,
  blendMode: 'NORMAL',
  customEffectId: { assetRef: SHADER_ASSET },
  componentPropAssignments: ASSIGNMENTS
}

const LOCAL_SHADER: Paint = {
  ...LIBRARY_SHADER,
  customEffectId: { guid: { sessionID: 5, localID: 6 } }
}

function record(localID: number, type: string, parent?: number, fields = {}): NodeChange {
  return {
    guid: guid(localID),
    type,
    phase: 'CREATED',
    name: `${type} ${localID}`,
    ...(parent === undefined
      ? {}
      : { parentIndex: { guid: guid(parent), position: `${localID}` } }),
    ...fields
  } as NodeChange
}

function archiveOf(
  shader: Paint,
  withDefinition = false,
  layer: NodeChange = record(10, 'RECTANGLE', 1, {
    name: 'Plate',
    size: { x: 40, y: 20 },
    fillPaints: [SOLID, shader]
  })
): ArrayBuffer {
  const kiwi = getCompiledSchema().encodeMessage({
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges: [
      record(0, 'DOCUMENT'),
      record(1, 'CANVAS', 0),
      layer,
      ...(withDefinition ? shaderDefinitionRecords(guid(0), guid(2), guid(20)) : [])
    ]
  })
  return new Uint8Array(
    writeFigArchive({
      schemaDeflated: deflateSync(getSchemaBytes()),
      kiwiData: kiwi,
      thumbnailPNG: new Uint8Array(),
      metaJSON: '{}'
    })
  ).buffer
}

async function opened(shader: Paint, withDefinition = false) {
  const graph = await parseFigFile(archiveOf(shader, withDefinition), { populate: 'all' })
  const plate = expectDefined(
    collectAllNodes(graph).find((node) => node.name === 'Plate'),
    'plate'
  )
  return { graph, plate }
}

async function savedPaints(graph: SceneGraph): Promise<Paint[]> {
  const saved = parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
  const plate = expectDefined(
    saved.nodeChanges.find((change) => change.name === 'Plate'),
    'saved plate'
  )
  return expectDefined(plate.fillPaints, 'saved fill paints')
}

async function savedStrokes(graph: SceneGraph): Promise<Paint[]> {
  const saved = parseFigBuffer((await exportFigFile(graph)).slice().buffer as ArrayBuffer)
  const plate = expectDefined(
    saved.nodeChanges.find((change) => change.name === 'Plate'),
    'saved plate'
  )
  return expectDefined(plate.strokePaints, 'saved stroke paints')
}

function shaderOf(paints: Paint[]): Paint {
  return expectDefined(
    paints.find((paint) => paint.type === 'CUSTOM'),
    'shader paint'
  )
}

const RECOLORED = { r: 0.75, g: 0.25, b: 0.125, a: 1 }

const recolored = (fills: Fill[]): Fill[] =>
  fills.map((fill) => (fill.type === 'SOLID' ? { ...fill, color: RECOLORED } : fill))

const EDITS: Record<string, (fills: Fill[]) => Fill[]> = {
  'a recoloured solid paint': recolored,
  'reordered paints': (fills) => fills.toReversed(),
  'a hidden solid paint': (fills) =>
    fills.map((fill) => (fill.type === 'SOLID' ? { ...fill, visible: false } : fill))
}

beforeAll(initCodec)

describe('Figma shader paints through a .fig archive', () => {
  for (const [form, shader] of [
    ['library', LIBRARY_SHADER],
    ['local', LOCAL_SHADER]
  ] as const) {
    test(`a ${form} shader keeps its reference and parameters through a save`, async () => {
      const { graph } = await opened(shader)
      const kept = shaderOf(await savedPaints(graph))
      expect(kept.customEffectId).toEqual(shader.customEffectId)
      expect(kept.componentPropAssignments).toEqual(ASSIGNMENTS)
    })

    for (const [edit, change] of Object.entries(EDITS)) {
      test(`a ${form} shader keeps its reference and parameters after ${edit}`, async () => {
        const { graph, plate } = await opened(shader)
        graph.updateNode(plate.id, { fills: change(plate.fills) })
        const kept = shaderOf(await savedPaints(graph))
        expect(kept).toEqual(shader)
      })
    }
  }

  test('an edited layer writes back the edit beside the shader paint', async () => {
    const { graph, plate } = await opened(LIBRARY_SHADER)
    graph.updateNode(plate.id, { fills: recolored(plate.fills) })
    const [solid] = await savedPaints(graph)
    expect(solid.color).toEqual(RECOLORED)
  })
  const DRAWN_SHADER: Fill = {
    type: 'CUSTOM',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true
  }

  for (const [form, fill, written] of [
    ['node ID', { ...DRAWN_SHADER, customEffectId: '5:6' }, { guid: { sessionID: 5, localID: 6 } }],
    [
      'library key',
      { ...DRAWN_SHADER, customEffectAssetRef: { key: 'abc', version: 'v1' } },
      { assetRef: { key: 'abc', version: 'v1' } }
    ]
  ] as const) {
    test(`a shader paint made in OpenPencil saves its ${form}`, async () => {
      const graph = new SceneGraph()
      graph.createNode('RECTANGLE', graph.getPages()[0].id, {
        name: 'Plate',
        width: 4,
        height: 4,
        fills: [fill]
      })
      expect(shaderOf(await savedPaints(graph)).customEffectId).toEqual(written)
    })
  }
  test('a design JSX layer whose strokes name a paint type saves', async () => {
    const graph = new SceneGraph()
    const red = '{ r: 1, g: 0, b: 0, a: 1 }'
    await renderJSX(
      graph,
      `<Rectangle name="Plate" w={40} h={40} strokes={[{ type: 'SOLID', color: ${red}, align: 'center' }, { type: 'GARBAGE', color: ${red} }]} />`
    )
    const saved = await savedStrokes(graph)
    expect(saved.map((paint) => paint.type)).toEqual(['SOLID', 'SOLID'])
  })

  test("opening a text whose range has a shader paint brings the shader's definition", async () => {
    const text = record(10, 'TEXT', 1, {
      name: 'Plate',
      size: { x: 40, y: 20 },
      fillPaints: [SOLID],
      textData: {
        characters: 'Hi there',
        characterStyleIDs: [0, 0, 0, 1, 1, 1, 1, 1],
        styleOverrideTable: [{ styleID: 1, fillPaints: [LIBRARY_SHADER] }]
      }
    })
    const graph = await parseFigFile(archiveOf(LIBRARY_SHADER, true, text), { populate: 'all' })
    expect([...graph.nodes.values()].filter((node) => node.type === 'CODE_COMPONENT')).toHaveLength(
      1
    )
  })

  test("opening a shader paint brings the shader's definition onto the internal page", async () => {
    const { graph } = await opened(LIBRARY_SHADER, true)
    const definition = expectDefined(
      [...graph.nodes.values()].find((node) => node.type === 'CODE_COMPONENT'),
      'definition'
    )
    expect(graph.getNode(definition.parentId ?? '')?.internalOnly).toBe(true)
  })
})
