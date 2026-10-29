import { describe, expect, test } from 'bun:test'

import type { KiwiNodeChange } from '#fig/node-change/export/context'
import { extractNodeStatus, serializeNodeStatus } from '#fig/node-change/status'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'
import {
  OPEN_PENCIL_PLUGIN_DATA,
  OPEN_PENCIL_PLUGIN_ID
} from '@open-pencil/scene-graph/plugin-data'

function written(status: string): NodeChange {
  let id = 0
  const node = createDefaultNode(() => String(++id), 'SECTION', { status })
  const nc: KiwiNodeChange = {}
  serializeNodeStatus(node, nc)
  return {
    ...nc,
    pluginData: node.pluginData.map((entry) => ({
      pluginID: entry.pluginId,
      key: entry.key,
      value: entry.value
    }))
  }
}

describe('section status in .fig records', () => {
  test('writes Ready for dev and Completed as Figma stores them', () => {
    expect(written('ready-for-dev').sectionStatusInfo).toEqual({ status: 'BUILD' })
    expect(written('completed').sectionStatusInfo).toEqual({ status: 'COMPLETED' })
  })

  test('a status Figma has no counterpart for lives in plugin data only', () => {
    const nc = written('approved')
    expect(nc.sectionStatusInfo).toBeUndefined()
    expect(extractNodeStatus(nc)).toBe('approved')
  })

  test('a status changed in Figma wins over the one OpenPencil wrote', () => {
    expect(
      extractNodeStatus({ ...written('approved'), sectionStatusInfo: { status: 'COMPLETED' } })
    ).toBe('completed')
    expect(
      extractNodeStatus({ ...written('ready-for-dev'), sectionStatusInfo: { status: 'NONE' } })
    ).toBeNull()
  })

  test("Figma's status reads without plugin data, and a malformed entry is ignored", () => {
    const nc: NodeChange = {
      sectionStatusInfo: { status: 'BUILD' },
      pluginData: [
        { pluginID: OPEN_PENCIL_PLUGIN_ID, key: OPEN_PENCIL_PLUGIN_DATA.status.key, value: '{' }
      ]
    }
    expect(extractNodeStatus(nc)).toBe('ready-for-dev')
  })
})
