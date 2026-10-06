import { describe, expect, test } from 'bun:test'

import { parseToolDescriptor, type ToolDescriptor } from '@open-pencil/mcp/tools'

const descriptor = {
  name: 'export_image',
  description: 'Exports a node as an image',
  effect: 'read',
  availability: 'filesystem',
  capabilities: ['document:read', 'filesystem:write'],
  enabled: true
} satisfies ToolDescriptor

describe('parseToolDescriptor', () => {
  test('reads a descriptor the server reports', () => {
    expect(parseToolDescriptor({ ...descriptor, extra: 1 })).toEqual(descriptor)
  })

  test('rejects a descriptor with a field the app cannot act on', () => {
    for (const change of [
      { name: '' },
      { effect: 'delete' },
      { availability: 'always' },
      { capabilities: ['document:read', 'shell:run'] },
      { enabled: 'true' }
    ]) {
      expect(parseToolDescriptor({ ...descriptor, ...change })).toBeNull()
    }
  })
})
