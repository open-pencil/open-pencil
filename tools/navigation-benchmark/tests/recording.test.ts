import { describe, expect, test } from 'bun:test'

import { parseRecording } from '../src/recording'

describe('navigation recording validation', () => {
  test('rejects unordered samples', () => {
    expect(() =>
      parseRecording({
        schemaVersion: 1,
        name: 'bad',
        source: 'synthetic',
        recordedAt: '',
        environment: {},
        sceneRenderer: 'existing',
        initialViewport: { panX: 0, panY: 0, zoom: 1 },
        trace: [],
        wheel: [
          { timeMs: 2, deltaX: 0, deltaY: 1, deltaMode: 0, clientX: 0, clientY: 0 },
          { timeMs: 1, deltaX: 0, deltaY: 1, deltaMode: 0, clientX: 0, clientY: 0 }
        ]
      })
    ).toThrow('ordered')
  })
})
