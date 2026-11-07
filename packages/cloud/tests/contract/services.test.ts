import { describe, expect, test } from 'bun:test'

import {
  servicesTokenClaimsSchema,
  CLOUD_SERVICES_TOKEN_AUDIENCE,
  CLOUD_PROTOCOL_VERSION,
  parseCloudDiscovery,
  parseCreateServicesToken,
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

describe('Cloud services contract', () => {
  test('discovery stays valid without services, so older servers still parse', () => {
    expect(parseCloudDiscovery(discovery).services).toBeUndefined()
  })

  test('discovery advertises services only for a contract version editors speak', () => {
    const services = { endpoint: 'https://services.example.com', contractVersion: '1' as const }
    expect(parseCloudDiscovery({ ...discovery, services }).services).toEqual(services)
    expect(() =>
      parseCloudDiscovery({ ...discovery, services: { ...services, contractVersion: '2' } })
    ).toThrow()
  })

  test('token requests name a workspace by its ID', () => {
    const workspaceId = crypto.randomUUID()
    expect(parseCreateServicesToken({ workspaceId })).toEqual({ workspaceId })
    expect(() => parseCreateServicesToken({ workspaceId: 'personal' })).toThrow()
  })

  test('token claims carry the workspace and its allowance for services', () => {
    const claims = {
      iss: 'https://cloud.example.com',
      aud: CLOUD_SERVICES_TOKEN_AUDIENCE,
      sub: 'user-1',
      workspaceId: crypto.randomUUID(),
      monthlyCreditAllowance: null,
      iat: 1,
      exp: 2
    }
    expect(v.parse(servicesTokenClaimsSchema, claims)).toEqual(claims)
    expect(v.is(servicesTokenClaimsSchema, { ...claims, aud: 'other' })).toBe(false)
  })
})

describe('workspace entitlements contract', () => {
  test('reads entitlements from servers released before services', () => {
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
    expect(entitlements.features.cloudServices).toBe(false)
    expect(entitlements.limits.monthlyCreditAllowance).toBeNull()
  })
})
