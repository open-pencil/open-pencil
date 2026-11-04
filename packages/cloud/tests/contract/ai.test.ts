import { describe, expect, test } from 'bun:test'

import {
  aiTokenClaimsSchema,
  CLOUD_AI_TOKEN_AUDIENCE,
  CLOUD_PROTOCOL_VERSION,
  parseCloudDiscovery,
  parseCreateAIToken,
  workspaceEntitlementsSchema
} from '#cloud/contract'
import * as v from 'valibot'

const discovery = {
  protocolVersion: CLOUD_PROTOCOL_VERSION,
  deployment: 'official' as const,
  apiURL: 'https://cloud.example.com/api',
  authURL: 'https://cloud.example.com/api/auth',
  authentication: { socialProviders: [], enterpriseSSO: false },
  capabilities: { documents: true, workspaces: true, collaboration: true }
}

describe('Cloud AI contract', () => {
  test('discovery stays valid without an AI service, so older servers still parse', () => {
    expect(parseCloudDiscovery(discovery).ai).toBeUndefined()
  })

  test('discovery advertises an AI service only for a contract version editors speak', () => {
    const ai = { endpoint: 'https://ai.example.com', contractVersion: '1' as const }
    expect(parseCloudDiscovery({ ...discovery, ai }).ai).toEqual(ai)
    expect(() =>
      parseCloudDiscovery({ ...discovery, ai: { ...ai, contractVersion: '2' } })
    ).toThrow()
  })

  test('token requests name a workspace by its ID', () => {
    const workspaceId = crypto.randomUUID()
    expect(parseCreateAIToken({ workspaceId })).toEqual({ workspaceId })
    expect(() => parseCreateAIToken({ workspaceId: 'personal' })).toThrow()
  })

  test('token claims carry the workspace and its allowance for the AI service', () => {
    const claims = {
      iss: 'https://cloud.example.com',
      aud: CLOUD_AI_TOKEN_AUDIENCE,
      sub: 'user-1',
      workspaceId: crypto.randomUUID(),
      monthlyCreditAllowance: null,
      iat: 1,
      exp: 2
    }
    expect(v.parse(aiTokenClaimsSchema, claims)).toEqual(claims)
    expect(v.is(aiTokenClaimsSchema, { ...claims, aud: 'other' })).toBe(false)
  })
})

describe('workspace entitlements contract', () => {
  test('reads entitlements from servers released before the AI service', () => {
    const entitlements = v.parse(workspaceEntitlementsSchema, {
      features: {
        links: true,
        guestView: true,
        guestEdit: false,
        guestPresence: true,
        collaboration: true,
        revisionHistory: true
      },
      limits: { maximumFileBytes: 1, maximumStorageBytes: null, maximumParticipants: null },
      usage: { committedStorageBytes: 0, reservedStorageBytes: 0 }
    })
    expect(entitlements.features.cloudAI).toBe(false)
    expect(entitlements.limits.monthlyCreditAllowance).toBeNull()
  })
})
