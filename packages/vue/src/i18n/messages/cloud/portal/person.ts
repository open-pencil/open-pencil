import { count, params } from '@nanostores/i18n'

/**
 * Messages of the `cloudPortal` namespace for one person's page in the console: their account,
 * ways to sign in, workspaces, and sessions.
 */
export const personPortalMessageDefaults = {
  backToPeople: 'All people',
  personAccount: 'Account',
  emailVerified: 'Verified',
  emailNotVerified: 'Not verified',
  joinedRow: 'Joined',
  lastActiveRow: 'Last active',
  signInMethods: 'Ways to sign in',
  twoStepRow: 'Two-step sign-in',
  twoStepNone: 'Not set up',
  passkeyCount: count({ one: '{count} passkey', many: '{count} passkeys' }),
  personWorkspaces: 'Workspaces',
  personWorkspacesEmpty: 'Not in any workspace.',
  workspaceMembers: count({ one: '{count} member', many: '{count} members' }),
  workspaceRoleAdmin: 'Admin',
  workspaceRoleEditor: 'Editor',
  workspaceRoleViewer: 'Viewer',
  personSessions: 'Sessions',
  noSessions: 'Not signed in anywhere.',
  personNotFound: 'There’s no such account',
  personNotFoundDescription: 'It may have been removed. Go back to the list of people.',
  removeSignInMethod: 'Remove',
  removeSignInMethodHeading: params('Remove {provider} from {name}’s ways to sign in?'),
  removeSignInMethodDescription:
    'They can’t sign in with it again unless they add it back, and they get an email saying so. Devices already signed in stay signed in until you sign them out everywhere.'
}
