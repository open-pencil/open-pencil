import { IS_BROWSER } from '@/constants'

export type CollaborationTransportMode = 'default' | 'test'

export interface AppRuntimeConfig {
  test: boolean
  navigationBenchmark: boolean
  recentFiles: boolean
  showChrome: boolean
  showRulers: boolean
  collaborationTransport: CollaborationTransportMode
  collaborationRelayURL: string | null
}

export function parseAppRuntimeConfig(search: string): AppRuntimeConfig {
  const params = new URLSearchParams(search)
  return {
    test: params.has('test'),
    navigationBenchmark: params.has('navigation-benchmark'),
    recentFiles: params.has('recent-files'),
    showChrome: !params.has('no-chrome'),
    showRulers: !params.has('no-rulers'),
    collaborationTransport: params.get('collabTransport') === 'test' ? 'test' : 'default',
    collaborationRelayURL: params.get('collabRelay')
  }
}

export const appRuntimeConfig = parseAppRuntimeConfig(IS_BROWSER ? window.location.search : '')
