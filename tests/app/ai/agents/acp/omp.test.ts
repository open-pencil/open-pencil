import { describe, expect, test } from 'bun:test'

import { ompOwnTool, shadowsOwnTools } from '@/app/ai/agents/acp/omp'

describe('Oh My Pi’s device names for OpenPencil’s tools', () => {
  test('only a device that is exactly one of OpenPencil’s tools is its own', () => {
    expect(ompOwnTool('xd://mcp__open_pencil_get_node')).toBe('get_node')
    expect(ompOwnTool('xd://mcp__open_pencil_extra_delete')).toBeNull()
    expect(ompOwnTool('xd://mcp__open_pencil_get_node_x')).toBeNull()
    expect(ompOwnTool('xd://mcp__github_get_node')).toBeNull()
  })

  test('a server shadows OpenPencil’s tools when its device names could equal theirs', () => {
    for (const name of ['open', 'Open Pencil', 'open-pencil-get', 'open_pencil']) {
      expect(shadowsOwnTools(name)).toBe(true)
    }
    for (const name of ['github', 'open-source', 'open-pencil-extra']) {
      expect(shadowsOwnTools(name)).toBe(false)
    }
  })
})
