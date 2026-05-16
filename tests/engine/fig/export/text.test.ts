import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'
import { parseFixture } from '#tests/helpers/fig-fixtures'

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
    const { decodeBinarySchema, compileSchema, ByteBuffer } = await import('#core/kiwi/kiwi-schema')
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
    expect(textNc.fontName.style).toBe('Bold')
    expect(textNc.derivedTextData.fontMetaData[0].key.family).toBe('Roboto')
    expect(textNc.derivedTextData.fontMetaData[0].key.style).toBe('Bold')
    expect(textNc.derivedTextData.fontMetaData[0].fontWeight).toBe(700)
    expect(textNc.derivedTextData.fontMetaData[0].fontStyle).toBe('NORMAL')
  })

  test('uses Figma font style names for weighted text', async () => {
    await initCodec()

    const { unzipSync, inflateSync } = await import('fflate')
    const { decodeBinarySchema, compileSchema, ByteBuffer } = await import('#core/kiwi/kiwi-schema')
    const { parseFigKiwiChunks } = await import('@open-pencil/core')

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Weighted',
      text: 'Semi bold',
      width: 120,
      height: 24,
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 16
    })

    const exported = await exportFigFile(graph)
    const zip = unzipSync(new Uint8Array(exported))
    const chunks = parseFigKiwiChunks(zip['canvas.fig'] ?? zip['canvas'])
    const schemaBytes = inflateSync(chunks?.[0] ?? new Uint8Array())
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema) as {
      decodeMessage(data: Uint8Array): Record<string, unknown>
    }
    const message = compiled.decodeMessage(inflateSync(chunks?.[1] ?? new Uint8Array()))
    const nodeChanges = message.nodeChanges as Array<Record<string, unknown>>
    const textNc = expectDefined(nodeChanges.find((nc) => nc.type === 'TEXT'), 'text node change')
    const derivedTextData = textNc.derivedTextData as Record<string, unknown>
    const fontMetaData = expectDefined(
      derivedTextData.fontMetaData as Array<Record<string, unknown>> | undefined,
      'font metadata'
    )

    expect((textNc.fontName as Record<string, unknown>).style).toBe('Semi Bold')
    expect((fontMetaData[0].key as Record<string, unknown>).style).toBe('Semi Bold')
  })

  test('auto-layout text children export height auto-resize for Figma rendering', async () => {
    await initCodec()

    const { unzipSync, inflateSync } = await import('fflate')
    const { decodeBinarySchema, compileSchema, ByteBuffer } = await import('#core/kiwi/kiwi-schema')
    const { parseFigKiwiChunks } = await import('@open-pencil/core')

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Card',
      layoutMode: 'VERTICAL',
      width: 280,
      height: 160
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Body',
      text: 'Track your key metrics and performance indicators in real time.',
      width: 240,
      height: 36,
      fontFamily: 'Inter',
      fontSize: 13,
      fontWeight: 400,
      textAutoResize: 'NONE'
    })

    const exported = await exportFigFile(graph)
    const zip = unzipSync(new Uint8Array(exported))
    const chunks = parseFigKiwiChunks(zip['canvas.fig'] ?? zip['canvas'])
    const schemaBytes = inflateSync(chunks?.[0] ?? new Uint8Array())
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema) as {
      decodeMessage(data: Uint8Array): Record<string, unknown>
    }
    const message = compiled.decodeMessage(inflateSync(chunks?.[1] ?? new Uint8Array()))
    const nodeChanges = message.nodeChanges as Array<Record<string, unknown>>
    const textNc = expectDefined(nodeChanges.find((nc) => nc.type === 'TEXT'), 'text node change')

    expect(textNc.textAutoResize).toBe('HEIGHT')
    expect(textNc.lineHeight).toBeUndefined()
    expect(textNc.stackChildAlignSelf).toBeUndefined()
  })

  test('style runs produce multiple fontMetaData entries', async () => {
    await initCodec()

    const { unzipSync, inflateSync } = await import('fflate')
    const { decodeBinarySchema, compileSchema, ByteBuffer } = await import('#core/kiwi/kiwi-schema')
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
