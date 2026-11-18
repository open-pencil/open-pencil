import { params } from '@nanostores/i18n'

/** Messages of the `cloudPortal` namespace for an account's personal access tokens. */
export const accessTokenPortalMessageDefaults = {
  accessTokens: 'Access tokens',
  accessTokensDescription: 'Tokens that let scripts and CI use your documents as you.',
  accessTokensIntro:
    'Send a token as {header}. It reads and saves documents as you, and can’t change how you sign in, make other tokens, or reach administration.',
  newAccessToken: 'New token',
  accessTokenNameHint: 'What uses it, such as Publish examples.',
  accessTokenExpiry: 'Expires after',
  accessTokenExpires30Days: '30 days',
  accessTokenExpires90Days: '90 days',
  accessTokenExpiresYear: '1 year',
  createAccessToken: 'Create token',
  accessTokenCreatedTitle: 'Copy your new token',
  accessTokenCreatedDescription:
    'Store it somewhere safe, such as a CI secret. It won’t be shown again.',
  columnCreated: 'Created',
  columnLastUsed: 'Last used',
  columnExpires: 'Expires',
  accessTokenNeverUsed: 'Never',
  accessTokenExpired: 'Expired',
  revokeAccessToken: 'Revoke',
  revokeAccessTokenHeading: params('Revoke {name}?'),
  revokeAccessTokenDescription: 'Anything using it stops working at once. This can’t be undone.',
  noAccessTokens: 'No tokens yet'
}
