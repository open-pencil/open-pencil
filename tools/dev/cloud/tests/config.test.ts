import { describe, expect, test } from 'bun:test'

import { composeProjectName, localCloudDeploymentTOML } from '#cloud-dev/config'

import { parseCloudDeploymentTOML } from '@lawha/cloud/server'

const secrets = {
  DATABASE_URL: 'postgresql://lawha:password@127.0.0.1:54329/lawha',
  BETTER_AUTH_SECRET: 'local-development-secret-at-least-32-characters',
  S3_ACCESS_KEY_ID: 'lawha',
  S3_SECRET_ACCESS_KEY: 'lawha-development-secret'
}

describe('local Cloud development configuration', () => {
  test('points branch URLs at the Compose services published on loopback', () => {
    const config = parseCloudDeploymentTOML(
      localCloudDeploymentTOML({
        cloudURL: 'https://feature.cloud.lawha.localhost',
        editorURL: 'https://feature.lawha.localhost',
        objectStorageURL: 'http://127.0.0.1:41000',
        smtpPort: 41025
      }),
      secrets
    )

    expect(config).toMatchObject({
      deployment: 'self-hosted',
      publicURL: 'https://feature.cloud.lawha.localhost',
      trustedOrigins: [
        'https://feature.lawha.localhost',
        'https://feature.cloud.lawha.localhost'
      ],
      emailPasswordEnabled: true,
      emailPasswordSignUpEnabled: true,
      passkeysEnabled: true,
      s3Endpoint: 'http://127.0.0.1:41000',
      emailTransport: 'smtp',
      smtpHost: '127.0.0.1',
      smtpPort: 41025,
      smtpSecure: false
    })
  })

  test('derives a Compose project name from the branch', () => {
    expect(composeProjectName('feature/cloud auth')).toBe('lawha-cloud-feature-cloud-auth')
    expect(composeProjectName('')).toBe('lawha-cloud-development')
  })
})
