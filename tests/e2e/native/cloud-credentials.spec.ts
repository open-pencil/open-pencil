import { strict as assert } from 'node:assert'

type NativeCredentialReference = {
  integrationId: string
  profileId: string
  field: 'session'
  readonly __nativeCredentialReference?: unique symbol
}

const first: NativeCredentialReference = {
  integrationId: 'openpencil-cloud',
  profileId: 'instance-first',
  field: 'session'
}
const second: NativeCredentialReference = {
  integrationId: 'openpencil-cloud',
  profileId: 'instance-second',
  field: 'session'
}

describe('native Cloud credentials', () => {
  it('stores and removes bearer sessions independently per instance', async () => {
    const values = await browser.tauri.execute(
      async ({ core }, { first, second }) => {
        await core.invoke('native_test_credential_write', {
          reference: first,
          value: 'first-token'
        })
        await core.invoke('native_test_credential_write', {
          reference: second,
          value: 'second-token'
        })
        const firstValue = await core.invoke('native_test_credential_read', {
          reference: first
        })
        const secondValue = await core.invoke('native_test_credential_read', {
          reference: second
        })
        await core.invoke('native_test_credential_remove', { reference: first })
        const removed = await core.invoke('native_test_credential_read', {
          reference: first
        })
        const retained = await core.invoke('native_test_credential_read', {
          reference: second
        })
        await core.invoke('native_test_credential_remove', { reference: second })
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
