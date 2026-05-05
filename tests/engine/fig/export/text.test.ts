import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { computeContentBounds } from '#core/io/formats/raster/render'

import {
  parseFigFile,
  computeAllLayouts,
  exportFigFile,
  importNodeChanges,
  initCodec,
  SceneGraph,
  FigmaAPI,
  type SceneNode,
  type Fill
} from '@open-pencil/core'

import { expectDefined } from '../../../helpers/assert'
import {
  FIXTURES,
  parseFixture,
  parseGoldPreviewFixture,
  VALID_NODE_TYPES
} from '../../../helpers/fig-fixtures'
import {
  childMatching,
  childNamed,
  collectAllNodes,
  countByType,
  previewChild
} from '../../../helpers/fig-traversal'
import { heavy } from '../../../helpers/test-utils'

setDefaultTimeout(60_000)

describe('text node export', () => {
  test('text nodes have derivedTextData and textUserLayoutVersion', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Greeting',
      text: 'Hello World',
      width: 120,
      height: 24,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = [...reimported.getAllNodes()].find((n) => n.name === 'Greeting')
    expect(textNode).toBeDefined()
    expect(expectDefined(textNode, 'textNode').type).toBe('TEXT')
    expect(textNode.text).toBe('Hello World')
    expect(textNode.fontFamily).toBe('Inter')
    expect(textNode.fontSize).toBe(16)
  })

  test('text node has lines in textData', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Multiline',
      text: 'Line 1\nLine 2\nLine 3',
      width: 100,
      height: 60,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14
    })

    const exported = await exportFigFile(graph)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const textNode = [...reimported.getAllNodes()].find((n) => n.name === 'Multiline')
    expect(textNode).toBeDefined()
    expect(expectDefined(textNode, 'textNode').text).toBe('Line 1\nLine 2\nLine 3')
  })

  test('derivedTextData fields present in raw binary', async () => {
    await initCodec()

    const { unzipSync, inflateSync } = await import('fflate')
    const { decodeBinarySchema, compileSchema, ByteBuffer } =
      await import('../../../../packages/core/src/kiwi/kiwi-schema')
    const { parseFigKiwiChunks } = await import('@open-pencil/core')

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Raw Test',
      text: 'Check binary',
      width: 80,
      height: 18,
      fontFamily: 'Roboto',
      fontWeight: 700,
      fontSize: 12
    })

    const exported = await exportFigFile(graph)
    const zip = unzipSync(new Uint8Array(exported))
    const canvasData = zip['canvas.fig'] ?? zip['canvas']
    expect(canvasData).toBeDefined()

    const chunks = parseFigKiwiChunks(canvasData)
    expect(chunks).not.toBeNull()
    expect(chunks?.length).toBeGreaterThanOrEqual(2)

    const schemaBytes = inflateSync(chunks?.[0] ?? new Uint8Array())
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema) as {
      decodeMessage(data: Uint8Array): Record<string, unknown>
    }
    const dataRaw = inflateSync(chunks?.[1] ?? new Uint8Array())
    const message = compiled.decodeMessage(dataRaw)

    const nodeChanges = message.nodeChanges as Array<Record<string, unknown>>
    const textNc = nodeChanges.find((nc) => nc.type === 'TEXT')
    expect(textNc).toBeDefined()

    expect(textNc.textData.characters).toBe('Check binary')
    expect(textNc.textData.lines).toBeDefined()
    expect(textNc.textData.lines.length).toBeGreaterThanOrEqual(1)
    expect(textNc.textData.lines[0].lineType).toBe('PLAIN')

    expect(textNc.textUserLayoutVersion).toBe(4)

    expect(textNc.derivedTextData).toBeDefined()
    expect(textNc.derivedTextData.layoutSize).toBeDefined()
    expect(textNc.derivedTextData.layoutSize.x).toBe(80)
    expect(textNc.derivedTextData.layoutSize.y).toBe(18)

    expect(textNc.derivedTextData.fontMetaData).toBeDefined()
    expect(textNc.derivedTextData.fontMetaData.length).toBe(1)
    expect(textNc.derivedTextData.fontMetaData[0].key.family).toBe('Roboto')
    expect(textNc.derivedTextData.fontMetaData[0].fontWeight).toBe(700)
    expect(textNc.derivedTextData.fontMetaData[0].fontStyle).toBe('NORMAL')
  })

  test('style runs produce multiple fontMetaData entries', async () => {
    await initCodec()

    const { unzipSync, inflateSync } = await import('fflate')
    const { decodeBinarySchema, compileSchema, ByteBuffer } =
      await import('../../../../packages/core/src/kiwi/kiwi-schema')
    const { parseFigKiwiChunks } = await import('@open-pencil/core')

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Styled',
      text: 'Bold and Normal',
      width: 150,
      height: 20,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      styleRuns: [
        { start: 0, length: 4, style: { fontWeight: 700 } },
        { start: 5, length: 10, style: {} }
      ]
    })

    const exported = await exportFigFile(graph)
    const zip = unzipSync(new Uint8Array(exported))
    const canvasData = zip['canvas.fig'] ?? zip['canvas']
    const chunks = parseFigKiwiChunks(canvasData)
    expect(chunks).toBeDefined()

    const schemaBytes = inflateSync(chunks?.[0] ?? new Uint8Array())
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema) as {
      decodeMessage(data: Uint8Array): Record<string, unknown>
    }
    const dataRaw = inflateSync(chunks?.[1] ?? new Uint8Array())
    const message = compiled.decodeMessage(dataRaw)

    const nodeChanges = message.nodeChanges as Array<Record<string, unknown>>
    const textNc = nodeChanges.find((nc) => nc.type === 'TEXT')

    const derivedTextData = textNc?.derivedTextData as Record<string, unknown> | undefined
    const fontMetaData = derivedTextData?.fontMetaData as Array<Record<string, unknown>> | undefined
    expect(fontMetaData?.length).toBe(2)

    const families = (fontMetaData ?? []).map(
      (m) => (m.key as Record<string, unknown>)?.style as string
    )
    expect(families).toContain('Bold')
    expect(families).toContain('Regular')
  })

  test('material3.fig text nodes have derivedTextData after round-trip', async () => {
    const original = await parseFixture('material3.fig')

    const textNodes = [...original.getAllNodes()].filter((n) => n.type === 'TEXT')
    expect(textNodes.length).toBeGreaterThan(0)

    const exported = await exportFigFile(original)
    const reimported = await parseFigFile(exported.buffer as ArrayBuffer)

    const reimportedText = [...reimported.getAllNodes()].filter((n) => n.type === 'TEXT')
    expect(reimportedText.length).toBe(textNodes.length)

    for (const node of reimportedText.slice(0, 10)) {
      expect(node.text.length).toBeGreaterThan(0)
    }
  })
})
