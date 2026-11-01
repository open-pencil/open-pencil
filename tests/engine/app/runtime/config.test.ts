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
      sceneRendererOverride: true,
      collaborationTransport: 'test',
      collaborationRelayURL: 'ws://localhost:4000'
    })
  })

  test('uses a persisted renderer preference when no URL override is present', () => {
    expect(parseAppRuntimeConfig('', 'tiled').sceneRenderer).toBe('tiled')
    expect(parseAppRuntimeConfig('?renderer=unknown', 'tiled').sceneRenderer).toBe('tiled')
  })

  test('valid renderer URL overrides take precedence over preferences', () => {
    expect(parseAppRuntimeConfig('?renderer=retained', 'tiled').sceneRenderer).toBe('retained')
    expect(parseAppRuntimeConfig('?renderer=tiled', 'retained').sceneRenderer).toBe('tiled')
  })

  test('uses production-safe defaults for absent or unknown values', () => {
    expect(parseAppRuntimeConfig('?renderer=unknown')).toEqual({
      test: false,
      navigationBenchmark: false,
      recentFiles: false,
      showChrome: true,
      showRulers: true,
      sceneRenderer: 'tiled',
      sceneRendererOverride: false,
      collaborationTransport: 'default',
      collaborationRelayURL: null
    })
  })
})
