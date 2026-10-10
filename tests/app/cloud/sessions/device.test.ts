import { describe, expect, test } from 'bun:test'

import { CloudDeviceAuthorizationError } from '@open-pencil/cloud/client'

import {
  createCloudDeviceSignIn,
  type CloudDeviceSignInDependencies
} from '@/app/cloud/sessions/device'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'

const discovery = cloudDiscoveryFixture()
const authorization = {
  device_code: 'device',
  user_code: 'ABCD-EFGH',
  verification_uri: 'https://cloud.example/cloud/device',
  verification_uri_complete: 'https://cloud.example/cloud/device?user_code=ABCD-EFGH',
  expires_in: 900,
  interval: 5
}

function dependencies(poll: CloudDeviceSignInDependencies['poll']) {
  const saved = new Map<string, string>()
  const opened: string[] = []
  const deps: CloudDeviceSignInDependencies = {
    request: async () => authorization,
    poll,
    open: async (url) => {
      opened.push(url)
    },
    save: async (id, token) => {
      saved.set(id, token)
    },
    clear: async (id) => {
      saved.delete(id)
    }
  }
  return { deps, saved, opened }
}

const token = { access_token: 'token', token_type: 'Bearer' as const, expires_in: 60, scope: '' }

describe('device-code sign-in', () => {
  test('opens the approval page, waits, and keeps the token', async () => {
    const { deps, saved, opened } = dependencies(async () => token)
    const signIn = createCloudDeviceSignIn(deps)
    expect(await signIn.start('server', discovery)).toBe(true)
    expect(opened).toEqual([authorization.verification_uri_complete])
    expect(saved.get('server')).toBe('token')
    expect(signIn.state.value.status).toBe('signed-in')
  })

  test('shows the code while it waits', async () => {
    let release: () => void = () => undefined
    const { deps } = dependencies(
      () =>
        new Promise((resolve) => {
          release = () => resolve(token)
        })
    )
    const signIn = createCloudDeviceSignIn(deps)
    const done = signIn.start('server', discovery)
    await Promise.resolve()
    await Promise.resolve()
    expect(signIn.state.value).toMatchObject({ status: 'waiting', code: 'ABCD-EFGH' })
    release()
    await done
  })

  test('reports a denied or expired code', async () => {
    const { deps } = dependencies(async () => {
      throw new CloudDeviceAuthorizationError('denied')
    })
    const signIn = createCloudDeviceSignIn(deps)
    expect(await signIn.start('server', discovery)).toBe(false)
    expect(signIn.state.value.status).toBe('denied')
  })

  test('drops a token that arrives after the person cancelled', async () => {
    let release: () => void = () => undefined
    const { deps, saved } = dependencies(
      () =>
        new Promise((resolve) => {
          release = () => resolve(token)
        })
    )
    const signIn = createCloudDeviceSignIn(deps)
    const done = signIn.start('server', discovery)
    await Promise.resolve()
    await Promise.resolve()
    signIn.cancel()
    release()
    expect(await done).toBe(false)
    expect(saved.has('server')).toBe(false)
    expect(signIn.state.value.status).toBe('idle')
  })
})
