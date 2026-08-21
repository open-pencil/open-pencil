import { strict as assert } from 'node:assert'

type CredentialRef = {
  integrationId: string
  profileId: string
  field: string
}

const first: CredentialRef = {
  integrationId: 'openpencil-cloud',
  profileId: 'instance-first',
  field: 'session'
}
const second: CredentialRef = {
  integrationId: 'openpencil-cloud',
  profileId: 'instance-second',
  field: 'session'
}

describe('native Cloud credentials', () => {
  it('stores and removes bearer sessions independently per instance', async () => {
    const values = await browser.execute(
      async ({ first, second }) => {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('native_test_credential_write', { reference: first, value: 'first-token' })
        await invoke('native_test_credential_write', { reference: second, value: 'second-token' })
        const firstValue = await invoke<string | null>('native_test_credential_read', {
          reference: first
        })
        const secondValue = await invoke<string | null>('native_test_credential_read', {
          reference: second
        })
        await invoke('native_test_credential_remove', { reference: first })
        const removed = await invoke<string | null>('native_test_credential_read', {
          reference: first
        })
        const retained = await invoke<string | null>('native_test_credential_read', {
          reference: second
        })
        await invoke('native_test_credential_remove', { reference: second })
        return { firstValue, secondValue, removed, retained }
      },
      { first, second }
    )

    assert.deepEqual(values, {
      firstValue: 'first-token',
      secondValue: 'second-token',
      removed: null,
      retained: 'second-token'
    })
  })
})
