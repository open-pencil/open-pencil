import { describe, expect, test } from 'bun:test'

import { cloudModulesIn } from '../src/modules'

const ROOT = '/repo'

describe('cloudModulesIn', () => {
  test('finds Cloud modules among a build’s modules', () => {
    expect(
      cloudModulesIn(
        [
          '/repo/src/app/cloud/sessions/connection.ts',
          '/repo/src/components/cloud/share/CloudShareButton.vue?vue&type=script&setup=true&lang.ts',
          '/repo/src/components/cloud/share/CloudShareButton.vue',
          '/repo/packages/cloud/src/client/index.ts',
          '/repo/src/app/collab/transport/cloud.ts',
          '/repo/src/components/home/cloud/CloudSharedSection.vue'
        ],
        ROOT
      )
    ).toEqual([
      'packages/cloud/src/client/index.ts',
      'src/app/cloud/sessions/connection.ts',
      'src/app/collab/transport/cloud.ts',
      'src/components/cloud/share/CloudShareButton.vue',
      'src/components/home/cloud/CloudSharedSection.vue'
    ])
  })

  test('allows the protocol, the stand-ins, and the provider’s identifier', () => {
    expect(
      cloudModulesIn(
        [
          '/repo/packages/cloud/src/contract/relay.ts',
          '/repo/src/app/cloud/integration/off/index.ts',
          '/repo/src/app/cloud/integration/off/storage.ts',
          '/repo/src/app/cloud/sessions/token.ts',
          '/repo/src/components/cloud/integration/off.ts',
          '/repo/src/app/storage/save-to.ts',
          '/repo/node_modules/vue/index.js',
          '\0virtual:pwa-register'
        ],
        ROOT
      )
    ).toEqual([])
  })

  test('counts the entry points themselves as Cloud', () => {
    expect(
      cloudModulesIn(
        [
          '/repo/src/app/cloud/integration/index.ts',
          '/repo/src/components/cloud/integration/index.ts'
        ],
        ROOT
      )
    ).toEqual(['src/app/cloud/integration/index.ts', 'src/components/cloud/integration/index.ts'])
  })
})
