import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'

import { parseFigBuffer } from '@open-pencil/fig'
import { nodeChangeToProps } from '@open-pencil/fig/node-change'

test('omitted primary sizing is Hug only for auto-layout; explicit Fixed remains Fixed', () => {
  expect(nodeChangeToProps({ type: 'FRAME', stackMode: 'HORIZONTAL' }, []).primaryAxisSizing).toBe(
    'HUG'
  )
  expect(
    nodeChangeToProps({ type: 'FRAME', stackMode: 'VERTICAL', stackPrimarySizing: 'FIXED' }, [])
      .primaryAxisSizing
  ).toBe('FIXED')
  expect(nodeChangeToProps({ type: 'FRAME' }, []).primaryAxisSizing).toBe('FIXED')
})

test('Gold date picker retains Figma Hug primary sizing when the saved field is omitted', async () => {
  const { nodeChanges, blobs } = parseFigBuffer(
    await Bun.file(
      new URL('../../../../tests/fixtures/gold-preview.fig', import.meta.url)
    ).arrayBuffer()
  )
  const diagnostics: unknown[] = []
  const root = interpretInstance(nodeChanges, '1:3516', {
    derivedBounds: true,
    onUnresolvedProperty: (diagnostic) => diagnostics.push(diagnostic)
  })
  const inline = root.children.find((node) => node.properties.name === 'Inline')
  if (!inline) throw new Error('Missing Inline')
  // Live Figma oracle: both nodes report primaryAxisSizingMode=AUTO.
  for (const node of [root, inline]) {
    expect(node.properties.stackPrimarySizing).toBeUndefined()
    expect(nodeChangeToProps(node.properties, blobs).primaryAxisSizing).toBe('HUG')
  }
})
