import { describe, expect, test } from 'bun:test'

import { exportFigFile, FigmaAPI, SceneGraph, initCodec, parseFigFile } from '@open-pencil/core'

describe('plugin data', () => {
  test('figma proxy supports private and shared plugin data methods', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()

    frame.setPluginData('okhcl', '{"l":0.7}')
    frame.setPluginData('empty', 'temp')
    frame.setPluginData('empty', '')

    frame.setSharedPluginData('tokens', 'accent', '{"h":240}')
    frame.setSharedPluginData('tokens', 'remove-me', 'x')
    frame.setSharedPluginData('tokens', 'remove-me', '')

    expect(frame.getPluginData('okhcl')).toBe('{"l":0.7}')
    expect(frame.getPluginData('missing')).toBe('')
    expect(frame.getPluginDataKeys()).toEqual(['okhcl'])

    expect(frame.getSharedPluginData('tokens', 'accent')).toBe('{"h":240}')
    expect(frame.getSharedPluginData('tokens', 'missing')).toBe('')
    expect(frame.getSharedPluginDataKeys('tokens')).toEqual(['accent'])
  })

  test('roundtrips private and shared plugin data through fig export/import', async () => {
    await initCodec()

    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()
    frame.name = 'Plugin data frame'
    frame.setPluginData('okhcl', '{"l":0.7,"c":0.12,"h":240}')
    frame.setSharedPluginData('tokens', 'accent', '{"ref":"brand/500"}')

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    const parsedFrame = [...parsed.getAllNodes()].find((node) => node.name === 'Plugin data frame')

    expect(parsedFrame).toBeDefined()
    expect(parsedFrame?.pluginData).toContainEqual({
      pluginId: 'open-pencil',
      key: 'okhcl',
      value: '{"l":0.7,"c":0.12,"h":240}'
    })
    expect(parsedFrame?.sharedPluginData).toContainEqual({
      namespace: 'tokens',
      key: 'accent',
      value: '{"ref":"brand/500"}'
    })
  })

  test('preserves plugin relaunch data from imported fig files', async () => {
    await initCodec()
    const bytes = new Uint8Array(await Bun.file('./tests/fixtures/material3.fig').arrayBuffer())
    const graph = await parseFigFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    const nodeWithRelaunch = [...graph.getAllNodes()].find((node) => node.pluginRelaunchData.length > 0)

    expect(nodeWithRelaunch).toBeDefined()
    expect(nodeWithRelaunch?.pluginRelaunchData[0]).toMatchObject({
      pluginId: expect.any(String),
      command: expect.any(String),
      message: expect.any(String),
      isDeleted: expect.any(Boolean)
    })
  })
})
