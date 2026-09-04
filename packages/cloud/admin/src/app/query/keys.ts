export const cloudQueryKeys = {
  discovery: ['cloud', 'discovery'] as const,
  account: ['cloud', 'account'] as const,
  authenticationMethods: ['cloud', 'account', 'authentication-methods'] as const,
  mfa: ['cloud', 'account', 'mfa'] as const,
  passkeys: ['cloud', 'account', 'mfa', 'passkeys'] as const,
  workspaces: ['cloud', 'workspaces'] as const,
  session: ['cloud', 'session'] as const,
  enrollments: {
    all: ['cloud', 'admin', 'enrollments'] as const,
    list: (status: string) => ['cloud', 'admin', 'enrollments', status] as const
  },
  users: (search: string) => ['cloud', 'admin', 'users', search] as const,
  email: ['cloud', 'admin', 'email'] as const,
  audit: ['cloud', 'admin', 'audit'] as const,
  operations: ['cloud', 'admin', 'operations'] as const
}
