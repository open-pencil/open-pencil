import { describe, expect, test } from 'bun:test'

import { editorURL } from '#admin/app/editor-url'

import type { CloudDiscovery } from '@open-pencil/cloud/contract'

const discovery = {
  protocolVersion: '1',
  deployment: 'self-hosted',
  apiURL: 'https://cloud.example.com/api',
  authURL: 'https://cloud.example.com/api/auth',
  authentication: { socialProviders: [], enterpriseSSO: false, enrollmentMode: 'open' },
  capabilities: { documents: true, workspaces: true, collaboration: true }
} satisfies CloudDiscovery

describe('Cloud editor URL', () => {
  test('uses the configured editor URL', () => {
    expect(editorURL({ ...discovery, appURL: 'https://app.example.com/editor' })).toBe(
      'https://app.example.com/editor'
    )
  })

  test('falls back to the Cloud origin for protocol-v1 instances', () => {
    expect(editorURL(discovery)).toBe('https://cloud.example.com/')
  })
})
