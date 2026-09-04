import { describe, expect, test } from 'bun:test'

import { parseCloudDeploymentTOML } from '@open-pencil/cloud/server'

import { composeProjectName, localCloudDeploymentTOML } from '../src/local/config'

const environment = {
  DATABASE_URL: 'postgresql://openpencil:password@postgres:5432/openpencil',
  BETTER_AUTH_SECRET: 'local-development-secret-at-least-32-characters',
  S3_ACCESS_KEY_ID: 'openpencil',
  S3_SECRET_ACCESS_KEY: 'openpencil-development-secret'
}

describe('local Cloud development configuration', () => {
  test('enables verified credentials and private Mailpit SMTP for branch URLs', () => {
    const config = parseCloudDeploymentTOML(
      localCloudDeploymentTOML({
        cloudURL: 'https://feature.cloud.open-pencil.localhost',
        editorURL: 'https://feature.open-pencil.localhost'
      }),
      environment
    )

    expect(config).toMatchObject({
      deployment: 'self-hosted',
      publicURL: 'https://feature.cloud.open-pencil.localhost',
      appURL: 'https://feature.open-pencil.localhost',
      trustedOrigins: [
        'https://feature.open-pencil.localhost',
        'https://feature.cloud.open-pencil.localhost'
      ],
      emailPasswordEnabled: true,
      emailPasswordSignUpEnabled: true,
      emailPasswordMinimumLength: 15,
      compromisedPasswordCheck: false,
      deploymentAdminMFARequired: false,
      totpEnabled: true,
      passkeysEnabled: true,
      recoveryCodesEnabled: true,
      passkeyRPID: 'feature.cloud.open-pencil.localhost',
      passkeyOrigin: 'https://feature.cloud.open-pencil.localhost',
      emailTransport: 'smtp',
      emailFrom: 'OpenPencil Cloud <cloud@openpencil.localhost>',
      smtpHost: 'mailpit',
      smtpPort: 1025,
      smtpSecure: false,
      emailIntervalMs: 1000
    })
  })

  test('creates stable Compose project names from branch names', () => {
    expect(composeProjectName('feature/cloud auth')).toBe('openpencil-cloud-feature-cloud-auth')
    expect(composeProjectName('')).toBe('openpencil-cloud-development')
  })
})
