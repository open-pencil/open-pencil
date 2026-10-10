export type CloudServerKind = 'official' | 'self-hosted'

export type CloudSignInMethod = 'google' | 'apple' | 'email'

export type CloudConnectStep = 'server' | 'checking' | 'sign-in' | 'device'

export type CloudConnectError = 'unreachable' | 'not-cloud' | 'outdated' | 'invalid-address'
