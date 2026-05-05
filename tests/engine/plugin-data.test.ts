import { describe, expect, test } from 'bun:test'

import { deduplicateNodeChangePluginData } from '#core/kiwi'

import {
  exportFigFile,
  FigmaAPI,
  importNodeChanges,
  initCodec,
  parseFigFile,
  SceneGraph,
  type NodeChange
} from '@open-pencil/core'

import { expectDefined } from '../helpers/assert'

function doc(): NodeChange {
  return {
    guid: { sessionID: 0, localID: 0 },
    type: 'DOCUMENT',
    name: 'Document',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  } as NodeChange
}

function canvas(localID = 1): NodeChange {
  return {
    guid: { sessionID: 0, localID },
    parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
    type: 'CANVAS',
    name: 'Page 1',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  } as NodeChange
}

function node(
  type: string,
  localID: number,
  parentLocalID: number,
  overrides: Partial<NodeChange> = {}
): NodeChange {
  return {
    guid: { sessionID: 1, localID },
    parentIndex: {
      guid: { sessionID: 0, localID: parentLocalID },
      position: String.fromCharCode(33 + localID)
    },
    type,
    name: `${type}_${localID}`,
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    size: { x: 100, y: 100 },
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    ...overrides
  } as NodeChange
}

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
    const parsed = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const parsedFrame = [...parsed.getAllNodes()].find((node) => node.name === 'Plugin data frame')

    expect(parsedFrame).toBeDefined()
    // Private plugin data roundtrips directly in pluginData array
    expect(parsedFrame?.pluginData).toContainEqual({
      pluginId: 'open-pencil',
      key: 'okhcl',
      value: '{"l":0.7,"c":0.12,"h":240}'
    })

    // Shared plugin data is stored in pluginData with key format "namespace/key".
    // Verify via the FigmaAPI proxy which reads through pluginData.
    const parsedApi = new FigmaAPI(parsed)
    const parsedProxy = parsedApi.getNodeById(parsedFrame?.id ?? '')
    expect(parsedProxy).toBeDefined()
    expect(parsedProxy?.getSharedPluginData('tokens', 'accent')).toBe('{"ref":"brand/500"}')
    expect(parsedProxy?.getSharedPluginDataKeys('tokens')).toEqual(['accent'])
  })

  test('preserves plugin relaunch data from imported fig files', async () => {
    await initCodec()
    const bytes = new Uint8Array(await Bun.file('./tests/fixtures/material3.fig').arrayBuffer())
    const graph = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const nodeWithRelaunch = [...graph.getAllNodes()].find(
      (node) => node.pluginRelaunchData.length > 0
    )

    expect(nodeWithRelaunch).toBeDefined()
    expect(nodeWithRelaunch?.pluginRelaunchData[0]).toMatchObject({
      pluginId: expect.any(String),
      command: expect.any(String),
      message: expect.any(String),
      isDeleted: expect.any(Boolean)
    })
  })
})

/**
 * Plugin data deduplication tests.
 *
 * Deduplication is performed by deduplicateNodeChangePluginData (fig-parse-core.ts)
 * before NodeChanges are passed to importNodeChanges. Corrupted or pathological
 * .fig files may contain millions of duplicate entries; deduplicateNodeChangePluginData
 * prevents them from reaching the scene graph.
 */
describe('plugin data deduplication', () => {
  test('deduplicateNodeChangePluginData removes duplicate pluginData entries', () => {
    const entries = [
      { pluginID: 'open-pencil', key: 'textDirection', value: 'RTL' },
      { pluginID: 'open-pencil', key: 'textDirection', value: 'RTL' },
      { pluginID: 'open-pencil', key: 'textDirection', value: 'RTL' }
    ]
    const changes: NodeChange[] = [doc(), canvas(), node('FRAME', 10, 1, { pluginData: entries })]

    deduplicateNodeChangePluginData(changes)
    const frameChange = expectDefined(
      changes.find((nc) => nc.type === 'FRAME'),
      'frame change'
    )
    expect(frameChange.pluginData).toHaveLength(1)
    expect(expectDefined(frameChange.pluginData?.[0], 'plugin data entry')).toEqual({
      pluginID: 'open-pencil',
      key: 'textDirection',
      value: 'RTL'
    })
  })

  test('importNodeChanges with unique pluginData entries preserves all', () => {
    const entries = [
      { pluginID: 'open-pencil', key: 'textDirection', value: 'RTL' },
      { pluginID: 'open-pencil', key: 'layoutDirection', value: 'LTR' },
      { pluginID: 'my-plugin', key: 'customKey', value: 'hello' }
    ]

    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, { pluginData: entries })
    ])

    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    expect(frame.pluginData).toHaveLength(3)
    expect(frame.pluginData).toContainEqual({
      pluginId: 'open-pencil',
      key: 'textDirection',
      value: 'RTL'
    })
    expect(frame.pluginData).toContainEqual({
      pluginId: 'open-pencil',
      key: 'layoutDirection',
      value: 'LTR'
    })
    expect(frame.pluginData).toContainEqual({
      pluginId: 'my-plugin',
      key: 'customKey',
      value: 'hello'
    })
  })

  test('importNodeChanges with single pluginData entry preserves it (zero-copy path)', () => {
    const entries = [{ pluginID: 'open-pencil', key: 'textDirection', value: 'LTR' }]

    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, { pluginData: entries })
    ])

    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    expect(frame.pluginData).toHaveLength(1)
    expect(frame.pluginData[0]).toEqual({
      pluginId: 'open-pencil',
      key: 'textDirection',
      value: 'LTR'
    })
  })

  test('importNodeChanges with empty pluginData returns empty array', () => {
    const graph = importNodeChanges([doc(), canvas(), node('FRAME', 10, 1, { pluginData: [] })])

    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    expect(frame.pluginData).toEqual([])
    // Must be an array, not undefined
    expect(Array.isArray(frame.pluginData)).toBe(true)
  })
})

describe('FigmaNodeProxy plugin data lazy shared computation', () => {
  test('getSharedPluginData computes from pluginData on demand', async () => {
    await initCodec()

    const entries = [{ pluginID: 'tokens', key: 'tokens/color', value: '{"h":240}' }]
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, { pluginData: entries })
    ])

    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]

    // Accessing via proxy reads directly from pluginData
    const api = new FigmaAPI(graph)
    const proxy = api.getNodeById(frame.id)
    const value = proxy?.getSharedPluginData('tokens', 'color') ?? ''
    expect(value).toBe('{"h":240}')
  })

  test('getSharedPluginDataKeys computes from pluginData on demand', async () => {
    await initCodec()

    const entries = [
      { pluginID: 'tokens', key: 'tokens/accent', value: '#ff0000' },
      { pluginID: 'tokens', key: 'tokens/bg', value: '#ffffff' }
    ]
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, { pluginData: entries })
    ])

    const api = new FigmaAPI(graph)
    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    const proxy = api.getNodeById(frame.id)

    const keys = proxy?.getSharedPluginDataKeys('tokens') ?? []
    expect(keys).toContain('accent')
    expect(keys).toContain('bg')
  })

  test('setSharedPluginData on lazy-populated node works correctly', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()

    // Set shared data directly (no lazy computation needed)
    frame.setSharedPluginData('tokens', 'primary', '#0000ff')

    expect(frame.getSharedPluginData('tokens', 'primary')).toBe('#0000ff')
    expect(frame.getSharedPluginDataKeys('tokens')).toEqual(['primary'])

    // Update the value
    frame.setSharedPluginData('tokens', 'primary', '#0000cc')
    expect(frame.getSharedPluginData('tokens', 'primary')).toBe('#0000cc')
    expect(frame.getSharedPluginDataKeys('tokens')).toEqual(['primary'])
  })
})

describe('FigmaNodeProxy plugin data split-brain regression', () => {
  test('update via setSharedPluginData does not duplicate on roundtrip', async () => {
    await initCodec()

    // Simulate an imported fig node with shared data encoded in pluginData
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, {
        pluginData: [{ pluginID: 'tokens', key: 'tokens/accent', value: 'v1' }]
      })
    ])

    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    const api = new FigmaAPI(graph)
    const proxy = expectDefined(api.getNodeById(frame.id), 'frame proxy')

    // Update: old pluginData entry must be replaced, not kept alongside the new one
    proxy.setSharedPluginData('tokens', 'accent', 'v2')

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const parsedPage = parsed.getPages()[0]
    const parsedFrame = parsed.getChildren(parsedPage.id)[0]

    // Exactly one tokens/accent entry, with the updated value
    const accentEntries = parsedFrame.pluginData.filter((e) => e.key === 'tokens/accent')
    expect(accentEntries).toHaveLength(1)
    expect(accentEntries[0].value).toBe('v2')

    const parsedApi = new FigmaAPI(parsed)
    const parsedProxy = expectDefined(parsedApi.getNodeById(parsedFrame.id), 'parsed frame proxy')
    expect(parsedProxy.getSharedPluginData('tokens', 'accent')).toBe('v2')
  })

  test('deletion via setSharedPluginData survives roundtrip', async () => {
    await initCodec()

    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, {
        pluginData: [{ pluginID: 'tokens', key: 'tokens/accent', value: 'v1' }]
      })
    ])

    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    const api = new FigmaAPI(graph)
    const proxy = expectDefined(api.getNodeById(frame.id), 'frame proxy')

    // Delete by setting empty string — must purge from pluginData
    proxy.setSharedPluginData('tokens', 'accent', '')

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const parsedPage = parsed.getPages()[0]
    const parsedFrame = parsed.getChildren(parsedPage.id)[0]

    // No tokens/accent entry should survive
    expect(parsedFrame.pluginData.some((e) => e.key === 'tokens/accent')).toBe(false)

    const parsedApi = new FigmaAPI(parsed)
    const parsedProxy = expectDefined(parsedApi.getNodeById(parsedFrame.id), 'parsed frame proxy')
    expect(parsedProxy.getSharedPluginData('tokens', 'accent')).toBe('')
  })
})

describe('extractPluginRelaunchData deduplication via importNodeChanges', () => {
  test('duplicate relaunch entries are deduplicated', async () => {
    await initCodec()

    const relaunchEntries = [
      { pluginID: 'my-plugin', command: 'edit', message: 'Edit widget', isDeleted: false },
      { pluginID: 'my-plugin', command: 'edit', message: 'Edit widget', isDeleted: false }
    ]

    const changes = [doc(), canvas(), node('FRAME', 10, 1, { pluginRelaunchData: relaunchEntries })]
    deduplicateNodeChangePluginData(changes)
    const graph = importNodeChanges(changes)

    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    // Duplicates should be collapsed
    expect(frame.pluginRelaunchData).toHaveLength(1)
    expect(frame.pluginRelaunchData[0]).toEqual({
      pluginId: 'my-plugin',
      command: 'edit',
      message: 'Edit widget',
      isDeleted: false
    })
  })

  test('unique relaunch entries are all preserved', async () => {
    await initCodec()

    const relaunchEntries = [
      { pluginID: 'plugin-a', command: 'edit', message: 'Edit', isDeleted: false },
      { pluginID: 'plugin-b', command: 'configure', message: 'Config', isDeleted: true }
    ]

    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, { pluginRelaunchData: relaunchEntries })
    ])

    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    expect(frame.pluginRelaunchData).toHaveLength(2)
  })

  test('empty relaunch data returns empty array', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, { pluginRelaunchData: [] })
    ])

    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    expect(frame.pluginRelaunchData).toEqual([])
  })
})

describe('plugin data namespace collision guards', () => {
  test('getPluginDataKeys excludes encoded shared keys but allows private slash keys', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()

    frame.setPluginData('foo', 'private-value')
    frame.setPluginData('foo/bar', 'private-slash-value')
    frame.setSharedPluginData('open-pencil', 'bar', 'shared-value')

    const keys = frame.getPluginDataKeys()
    expect(keys).toContain('foo')
    expect(keys).toContain('foo/bar')
    expect(keys).not.toContain('open-pencil/bar')
    expect(keys).not.toContain('bar')
  })

  test('getSharedPluginData does not read private open-pencil plugin data', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()

    // Write private data via setPluginData
    frame.setPluginData('textDirection', 'RTL')

    // getSharedPluginData with the 'open-pencil' namespace should NOT
    // return the private entry (which uses {pluginId: 'open-pencil', key: 'textDirection'})
    const sharedValue = frame.getSharedPluginData('open-pencil', 'textDirection')
    expect(sharedValue).toBe('')

    // Private data is still accessible via getPluginData
    const privateValue = frame.getPluginData('textDirection')
    expect(privateValue).toBe('RTL')
  })

  test('setSharedPluginData does not delete private open-pencil plugin data', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()

    // Write private data
    frame.setPluginData('layoutDirection', 'LTR')

    // Set shared data using the 'open-pencil' namespace —
    // this should NOT delete the private 'layoutDirection' entry
    frame.setSharedPluginData('open-pencil', 'custom-key', 'shared')

    const privateValue = frame.getPluginData('layoutDirection')
    expect(privateValue).toBe('LTR')

    // The shared data is stored correctly
    const sharedValue = frame.getSharedPluginData('open-pencil', 'custom-key')
    expect(sharedValue).toBe('shared')

    // And the private data key list does not include the shared-format key
    const keys = frame.getPluginDataKeys()
    expect(keys).toContain('layoutDirection')
    expect(keys).not.toContain('open-pencil/custom-key')
    expect(keys).not.toContain('custom-key')
  })

  test('getSharedPluginDataKeys does not leak private open-pencil keys', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()

    // Write private data
    frame.setPluginData('textDirection', 'RTL')

    // Write shared data for another namespace (should still work)
    frame.setSharedPluginData('tokens', 'accent', '#ff0000')

    const sharedKeys = frame.getSharedPluginDataKeys('open-pencil')
    expect(sharedKeys).not.toContain('textDirection')

    // Non-open-pencil shared data is accessible
    const tokensKeys = frame.getSharedPluginDataKeys('tokens')
    expect(tokensKeys).toContain('accent')
  })
})
