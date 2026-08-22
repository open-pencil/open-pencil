import { describe, expect, test } from 'bun:test'

import { parseAppRuntimeConfig } from '@/app/runtime/config'

describe('app runtime configuration', () => {
  test('parses supported development and presentation flags once', () => {
    expect(
      parseAppRuntimeConfig(
        '?test&navigation-benchmark&recent-files&no-chrome&no-rulers&renderer=tiled&collabTransport=test&collabRelay=ws%3A%2F%2Flocalhost%3A4000'
      )
    ).toEqual({
      test: true,
      navigationBenchmark: true,
      recentFiles: true,
      showChrome: false,
      showRulers: false,
      sceneRenderer: 'tiled',
      collaborationTransport: 'test',
      collaborationRelayURL: 'ws://localhost:4000'
    })
  })

  test('uses production-safe defaults for absent or unknown values', () => {
    expect(parseAppRuntimeConfig('?renderer=unknown')).toEqual({
      test: false,
      navigationBenchmark: false,
      recentFiles: false,
      showChrome: true,
      showRulers: true,
      sceneRenderer: 'existing',
      collaborationTransport: 'default',
      collaborationRelayURL: null
    })
  })
})
