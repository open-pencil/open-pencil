import { CLOUD_PROTOCOL_VERSION, type CloudDiscovery } from '@open-pencil/cloud/contract'

/** A Cloud server's discovery at `origin`, with email sign-in. */
export function cloudDiscoveryFixture(origin = 'https://cloud.example.com'): CloudDiscovery {
  return {
    protocolVersion: CLOUD_PROTOCOL_VERSION,
    deployment: 'self-hosted',
    apiURL: `${origin}/api`,
    authURL: `${origin}/api/auth`,
    localEditor: true,
    authentication: {
      socialProviders: ['google'],
      enterpriseSSO: false,
      enrollmentMode: 'approval',
      emailPassword: { signIn: true, signUp: true, minimumPasswordLength: 8 }
    },
    capabilities: { documents: true, workspaces: true, collaboration: true }
  }
}
