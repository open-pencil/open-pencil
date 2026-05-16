import { describe, it, expect } from 'bun:test'

import { toSpeedscopeJSON } from '@open-pencil/core'

describe('toSpeedscopeJSON', () => {
  it('produces valid speedscope JSON', () => {
    const capture = {
      timestamp: 0,
      totalTimeMs: 10,
      cpuTimeMs: 8,
      gpuTimeMs: 6,
      totalNodes: 5,
      culledNodes: 1,
      drawCalls: 10,
      scenePictureCacheHit: false,
      rootProfiles: [
        {
          nodeId: 'n1',
          name: 'Frame',
          type: 'FRAME',
          depth: 0,
          startTime: 0,
          endTime: 10,
          selfTime: 5,
          drawCalls: 3,
          culled: false,
          children: [
            {
              nodeId: 'n2',
              name: 'Rect',
              type: 'RECTANGLE',
              depth: 1,
              startTime: 2,
              endTime: 7,
              selfTime: 5,
              drawCalls: 2,
              culled: false,
              children: []
            }
          ]
        }
      ]
    }

    const json = toSpeedscopeJSON(capture)
    const parsed = JSON.parse(json)

    expect(parsed.$schema).toBe('https://www.speedscope.app/file-format-schema.json')
    expect(parsed.profiles).toHaveLength(1)
    expect(parsed.profiles[0].type).toBe('evented')
    expect(parsed.profiles[0].unit).toBe('milliseconds')
    expect(parsed.shared.frames).toHaveLength(2)
    expect(parsed.profiles[0].events).toHaveLength(4)
  })
})
