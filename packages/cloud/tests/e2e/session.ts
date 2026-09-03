import type {
  CloudActor,
  CloudIdentity,
  CloudIdentityResolver,
  CloudSessionResolver
} from '@open-pencil/cloud/server'

const TEST_SESSION_COOKIE = 'openpencil-cloud-e2e-session'

export const cloudE2EActors = {
  owner: {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'owner@cloud-e2e.test',
    name: 'Cloud Owner',
    deploymentRole: 'admin'
  },
  recipient: {
    userId: '22222222-2222-4222-8222-222222222222',
    email: 'recipient@cloud-e2e.test',
    name: 'Cloud Recipient'
  },
  pending: {
    userId: '33333333-3333-4333-8333-333333333333',
    email: 'pending@cloud-e2e.test',
    name: 'Pending User'
  }
} satisfies Record<string, CloudActor>

function requestIdentity(request: Request): CloudIdentity | null {
  const cookie = request.headers.get('cookie') ?? ''
  const session = cookie
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === TEST_SESSION_COOKIE)?.[1]
  return session === 'owner' || session === 'recipient' || session === 'pending'
    ? cloudE2EActors[session]
    : null
}

export function createCloudE2EIdentityResolver(): CloudIdentityResolver {
  return async (request) => requestIdentity(request)
}

export function createCloudE2ESessionResolver(): CloudSessionResolver {
  return async (request) => {
    const identity = requestIdentity(request)
    return identity?.userId === cloudE2EActors.pending.userId ? null : identity
  }
}
