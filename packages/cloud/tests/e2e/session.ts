import type { CloudActor, CloudSessionResolver } from '@open-pencil/cloud/server'

const TEST_SESSION_COOKIE = 'openpencil-cloud-e2e-session'

export const cloudE2EActors = {
  owner: {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'owner@cloud-e2e.test',
    name: 'Cloud Owner'
  },
  recipient: {
    userId: '22222222-2222-4222-8222-222222222222',
    email: 'recipient@cloud-e2e.test',
    name: 'Cloud Recipient'
  }
} satisfies Record<string, CloudActor>

export function createCloudE2ESessionResolver(): CloudSessionResolver {
  return async (request) => {
    const cookie = request.headers.get('cookie') ?? ''
    const session = cookie
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([name]) => name === TEST_SESSION_COOKIE)?.[1]
    return session === 'owner' || session === 'recipient' ? cloudE2EActors[session] : null
  }
}
