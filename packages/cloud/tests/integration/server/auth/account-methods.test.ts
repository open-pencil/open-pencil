import { describe, expect, test } from 'bun:test'

import {
  accountAuthenticationRequest,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount
} from '#cloud-test/helpers/account-authentication'
import * as v from 'valibot'

import { cloudAuthenticationMethodsResponseSchema } from '@open-pencil/cloud/contract'

describe('account authentication methods', () => {
  test('lists and unlinks methods while preserving another sign-in method', async () => {
    const fixture = await createAccountAuthenticationFixture()
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'active@example.com',
        name: 'Active Person',
        password: 'the original long password',
        approved: true
      })
      await fixture.database
        .insertInto('account')
        .values({
          id: crypto.randomUUID(),
          userId: account.userId,
          providerId: 'google',
          issuer: 'https://accounts.google.com',
          accountId: 'google-account',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .execute()
      const response = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/authentication',
          undefined,
          account.sessionCookie
        )
      )
      const body = v.parse(cloudAuthenticationMethodsResponseSchema, await response.json())
      expect(body.methods).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: 'credential', canUnlink: true }),
          expect.objectContaining({ provider: 'google', canUnlink: true })
        ])
      )
      expect(body.availableSocialProviders).toEqual([])
      const google = body.methods.find((method) => method.provider === 'google')
      if (!google) throw new Error('Expected a linked Google method')
      expect(
        (
          await fixture.app.fetch(
            accountAuthenticationRequest(
              '/api/account/authentication/unlink',
              { methodId: google.id },
              account.sessionCookie
            )
          )
        ).status
      ).toBe(200)
    } finally {
      await fixture.close()
    }
  })

  test('blocks restricted identities and protects the final sign-in method', async () => {
    const fixture = await createAccountAuthenticationFixture()
    try {
      const account = await createVerifiedCredentialAccount(fixture, {
        email: 'person@example.com',
        name: 'Person',
        password: 'a sufficiently long password',
        approved: false
      })
      expect(
        (
          await fixture.app.fetch(
            accountAuthenticationRequest(
              '/api/account/authentication',
              undefined,
              account.sessionCookie
            )
          )
        ).status
      ).toBe(401)
      expect(
        (
          await fixture.app.fetch(
            accountAuthenticationRequest(
              '/api/auth/list-accounts',
              undefined,
              account.sessionCookie
            )
          )
        ).status
      ).toBe(401)

      await fixture.database
        .insertInto('cloudEnrollment')
        .values({
          id: crypto.randomUUID(),
          emailNormalized: 'person@example.com',
          name: 'Person',
          reason: null,
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: 'admin',
          reviewNote: null,
          approvedUserId: account.userId
        })
        .execute()
      const methodsResponse = await fixture.app.fetch(
        accountAuthenticationRequest(
          '/api/account/authentication',
          undefined,
          account.sessionCookie
        )
      )
      const methods = v.parse(
        cloudAuthenticationMethodsResponseSchema,
        await methodsResponse.json()
      )
      expect(methods.methods).toHaveLength(1)
      expect(methods.methods[0]).toMatchObject({ provider: 'credential', canUnlink: false })
      const method = methods.methods[0]
      if (!method) throw new Error('Expected a credential method')
      expect(
        (
          await fixture.app.fetch(
            accountAuthenticationRequest(
              '/api/account/authentication/unlink',
              { methodId: method.id },
              account.sessionCookie
            )
          )
        ).status
      ).toBe(400)
    } finally {
      await fixture.close()
    }
  })
})
