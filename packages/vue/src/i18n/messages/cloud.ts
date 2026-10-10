import { count, params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

/** Copy for OpenPencil Cloud inside the editor: connecting, sharing, syncing, and Home. */
export const cloudMessageDefaults = {
  productName: 'OpenPencil Cloud',
  continue: 'Continue',
  tryAgain: 'Try again',
  signIn: 'Sign in',
  signOut: 'Sign out',
  workspace: 'Workspace',
  server: 'Server',
  share: 'Share',
  viewOnly: 'View only',
  canEdit: 'Can edit',
  canView: 'Can view',
  roleViewer: 'Viewer',
  roleEditor: 'Editor',
  roleAdmin: 'Admin',
  changedInTwoPlaces: params('“{name}” was changed in two places'),
  conflictDescription:
    'Someone saved a newer version while you had unsent changes. Nothing is lost until you choose.',

  // Connect
  connectHeading: 'Connect to OpenPencil Cloud',
  connectDescription: 'Keep files in sync across devices and invite people to edit with you.',
  deviceHeading: 'Confirm in your browser',
  deviceDescription: params('Approve this sign-in on {host}.'),
  deviceDescriptionNoHost: 'Approve this sign-in on the server.',
  signInDescription: params('Sign in to {host} to sync your files.'),
  signInDescriptionNoHost: 'Sign in to the server to sync your files.',
  officialDescription: params('Hosted by OpenPencil · {host}'),
  selfHostedLabel: 'Your team’s server',
  selfHostedDescription: 'A self-hosted OpenPencil Cloud',
  serverAddress: 'Server address',
  errorInvalidAddressHeading: 'Enter the server’s web address',
  errorInvalidAddressDescription:
    'Use the address your team gave you, such as https://cloud.example.com.',
  errorUnreachableHeading: 'Couldn’t reach this server',
  errorUnreachableDescription: 'Check the address and your connection, then try again.',
  errorNotCloudHeading: 'This isn’t an OpenPencil Cloud server',
  errorNotCloudDescription:
    'The address answered, but not as OpenPencil Cloud. Ask your team for the right one.',
  errorOutdatedHeading: 'This server needs an update',
  errorOutdatedDescription: 'It runs an older version of OpenPencil Cloud than this app supports.',
  errorDeniedHeading: 'Sign-in was denied',
  errorDeniedDescription: 'The request was turned down in the browser. Start again to sign in.',
  errorExpiredHeading: 'The code expired',
  errorExpiredDescription: 'It wasn’t approved in time. Start again to get a new one.',
  errorSignInFailedHeading: 'Couldn’t sign in',
  errorSignInFailedDescription: 'The server didn’t finish signing you in. Try again in a moment.',
  continueWithGoogle: 'Continue with Google',
  continueWithApple: 'Continue with Apple',
  continueWithEmail: 'Continue with email',
  signInNoteDesktop: 'Your browser opens to finish signing in, then you come back here.',
  signInNoteBrowser: 'You come back to this tab after signing in.',
  yourCode: 'Your code',
  copyCode: 'Copy code',
  deviceWaiting: params('Waiting for you to approve… The code expires in {duration}.'),
  openBrowserAgain: 'Open browser again',
  useAnotherServer: 'Use another server',
  accountPending: params('Your account on {host} is waiting for an administrator to approve it.'),
  signedInAs: params('Signed in to {host} as {email}.'),

  // Invitation
  invitationUnavailableHeading: 'This invitation can’t be used',
  invitationOpening: 'Opening invitation',
  invitedYou: params('{name} invited you'),
  invitationEditDescription: params('To edit a document on {host}.'),
  invitationViewDescription: params('To view a document on {host}.'),
  invitationChecking: 'Checking the invitation…',
  invitationUnavailableDescription: params(
    'It expired, was withdrawn, or was already accepted. Ask {name} for a new one.'
  ),
  invitationUnavailableDescriptionNoName:
    'It expired, was withdrawn, or was already accepted. Ask the person who sent it for a new one.',
  invitationSentTo: params('Sent to {recipient}'),
  invitationExpiresIn: params('Expires in {duration}'),
  unknownServerHeading: params('You haven’t used {host} before'),
  unknownServerDescription:
    'Only sign in if you trust this server. It stores the document and sees your edits.',
  invitationSignInHeading: params('Sign in to {host}'),
  invitationSignInDescription:
    'Use the account this invitation was sent to. The document opens right after.',
  wrongAccountHeading: 'This invitation is for another account',
  wrongAccountDescription: params(
    'You’re signed in as {email}. Sign in with {recipient} to open it.'
  ),
  notNow: 'Not now',
  signInToOpen: 'Sign in to open',
  useAnotherAccount: 'Use another account',
  openDocument: 'Open document',

  // Save
  saveHeading: 'Save to Cloud',
  saveDescription: 'Keep this design in sync across devices and share it with people.',
  saveName: 'Name',
  saveQuotaHeading: 'This workspace is out of space',
  saveQuotaDescription: 'Free some space or choose another workspace.',
  saveOfflineHeading: 'You’re offline',
  saveOfflineDescription:
    'Connect to the internet to save to Cloud. Nothing has changed on this device.',
  saveFailedHeading: 'Couldn’t save to Cloud',
  saveFailedDescription: 'The server didn’t accept the file. Try again in a moment.',
  saveUploading: params('Uploading… {sent} of {total}'),
  saveTooLargeHeading: 'This file is too large for this server',
  saveTooLargeDescription: params(
    'It takes files up to {limit}. Remove unused images or pages, then try again.'
  ),
  saveNote:
    'The Cloud copy opens in this tab and saves as you work. The file on this device stays as it is.',

  // Share
  shareHeading: params('Share “{name}”'),
  shareDescriptionInWorkspace: params('In {workspace} on OpenPencil Cloud'),
  shareDescription: 'On OpenPencil Cloud',
  shareAddPeople: 'Add people by email',
  shareEmailAddress: 'Email address',
  shareNewPeoplePermission: 'Permission for new people',
  shareInvite: 'Invite',
  sharePeopleWithAccess: 'People with access',
  shareYou: '(you)',
  shareInvited: 'Invited',
  shareInvitationExpires: params('Invitation expires {date}'),
  shareAccessFor: params('Access for {name}'),
  shareOwner: 'Owner',
  shareRemoveAccess: 'Remove access',
  shareEveryoneIn: params('Everyone in {workspace}'),
  shareMemberCount: count({ one: '{count} member', many: '{count} members' }),
  shareWorkspacePermissionTip: 'Set by the workspace; change it in the workspace’s settings',
  shareGeneralAccess: 'General access',
  shareRestricted: 'Only people with access',
  shareAnyoneWithLink: 'Anyone with the link',
  shareLinkDetail: 'Anyone who has the link can open this file without signing in.',
  shareRestrictedDetail: 'Only the people and workspace above can open this file.',
  shareRestrictedNoLinksDetail:
    'Only the people and workspace above can open this file. Links are turned off for this workspace.',
  shareLinkPermission: 'Link permission',
  shareCannotManage: 'Only the owner and editors can change who has access.',
  shareResetLinkTip:
    'This link was made on another device. Resetting it makes a new link and the old one stops working.',
  shareResetLink: 'Reset link',
  shareLinkCopied: 'Link copied',
  shareCopyLink: 'Copy link',
  shareLoadFailed: 'Couldn’t load who has access. Check your connection and try again.',
  shareChangeFailed: 'That change didn’t go through. Try again in a moment.',

  // Conflict
  conflictKeepBoth: 'Keep both',
  conflictKeepBothDescription: params(
    'The Cloud version stays as “{name}”. Yours is saved next to it as “{copyName}”.'
  ),
  conflictUseCloud: 'Use the Cloud version',
  conflictUseCloudDescription: 'Your unsent changes on this device are discarded.',
  conflictUseMine: 'Replace it with your version',
  conflictUseMineDescriptionBy: params('{name}’s latest changes are replaced for everyone.'),
  conflictUseMineDescription: 'The newer version on the server is replaced for everyone.',
  conflictConfirmUseCloud: 'Use Cloud version',
  conflictConfirmUseMine: 'Replace with mine',
  conflictYourVersion: 'Your version',
  conflictCloudVersion: 'Cloud version',
  conflictWhichVersion: 'Which version to keep',
  conflictDecideLater: 'Decide later',
  conflictYourCopyName: params('{name} (your copy)'),
  conflictYouOnThisDevice: 'You, on this device',
  conflictResolveFailed: 'Couldn’t resolve the conflict. Your changes are still on this device.',

  // Status
  statusViewOnlyDetail: 'You can look around and follow others, not edit.',
  statusSavedTo: params('Saved to {workspace}'),
  statusSavedAgo: params('Saved {time}'),
  statusUpToDate: 'Up to date',
  statusSaving: 'Saving…',
  statusUploadingTo: params('Uploading to {workspace}'),
  statusSavedOnDevice: 'Saved on this device',
  statusUploadsSoon: 'Uploads in a moment',
  statusOfflineDetail: 'You’re offline. Changes upload when you reconnect.',
  statusConflict: 'Changed in two places',
  statusConflictDetail: 'Someone saved a newer version while you edited. Choose which to keep.',
  statusErrorDetail: 'Your changes are safe on this device.',
  statusResolve: 'Resolve',
  statusChooseVersion: 'Choose a version',
  statusOpenWorkspace: 'Open workspace',

  // Settings
  settingsDescription:
    'Servers this app syncs documents with. Home shows one server’s workspaces at a time.',
  settingsEmptyDescription:
    'Keep files in sync across devices and edit them with others. Documents on this device stay where they are.',
  settingsConnectServer: 'Connect a server',
  settingsOfficialDescription: 'Hosted by OpenPencil, nothing to set up.',
  settingsSelfHostedDescription: 'A self-hosted OpenPencil Cloud, at the address your team uses.',
  settingsOnHome: 'On Home',
  settingsSignInExpired: 'Sign-in expired',
  settingsSignInExpiredFor: params('Sign-in expired for {email}'),
  settingsSignedOut: 'Signed out',
  settingsWaitingForApproval: 'Waiting for an administrator to approve your account',
  settingsAccessClosed: 'An administrator declined or removed your access',
  settingsOptionsFor: params('Options for {host}'),
  settingsAccountAndSecurity: 'Account and security',
  settingsShowOnHome: 'Show on Home',
  settingsRemoveFromApp: 'Remove from this app',
  settingsSignOutFailed: 'Couldn’t sign out. Check your connection and try again.',
  settingsRemoveHeading: params('Remove {host}?'),
  settingsRemoveDescription:
    'You’re signed out and its workspaces leave Home on this device. Documents stay on the server.',
  settingsRemoveUnsavedDescription: count({
    one: 'You’re signed out and its workspaces leave Home on this device. {count} document has changes that haven’t reached the server yet; removing it discards them.',
    many: 'You’re signed out and its workspaces leave Home on this device. {count} documents have changes that haven’t reached the server yet; removing it discards them.'
  }),
  settingsRemove: 'Remove',
  settingsRemoveAndDiscard: 'Remove and discard changes',

  // Home
  homeLocations: 'Locations',
  homeRecent: 'Recent',
  homeAccount: params('Account: {email}'),
  homeAccountSettings: 'Account settings',
  homeConnectAnotherServer: 'Connect another server…',
  homeAttentionTip: 'A file here needs a choice',
  homeNeedsAttention: 'Needs attention',
  homeSharedWithYou: 'Shared with you',
  homeSharedSubtitle: 'Files people invited you to',
  homeSharedBy: params('Shared by {name}'),
  homeSignIn: 'Sign in…',
  homeStorage: 'Storage',
  homeStorageSettings: 'Storage settings',
  homeCloudOnHost: params('OpenPencil Cloud · {host}'),
  homeUsageUsed: params('{used} used'),
  homeUsageOf: params('{used} of {total}'),
  homeWorkspaceStorage: params('Workspace storage, {usage}'),
  homeView: 'View',
  homeGrid: 'Grid',
  homeList: 'List',
  homeOfflineHeading: 'You’re offline',
  homeOfflineDescription:
    'These are the files saved on this device. Changes upload when you reconnect.',
  homeLoadFailedHeading: 'Couldn’t load this workspace',
  homeLoadFailedDescription:
    'The server didn’t answer. Files saved on this device are still listed.',
  homeConflicts: count({
    one: '{count} file was changed in two places',
    many: '{count} files were changed in two places'
  }),
  homeReview: 'Review',
  homeLoadingFiles: 'Loading files',
  homeEmptyWorkspace: params('No files in {workspace} yet'),
  homeEmptyWorkspaceDescription:
    'Create a design here, or save an open file to this workspace from the File menu.',
  homeNothingShared: 'Nothing shared with you yet',
  homeNothingSharedDescription: 'Files people invite you to show up here.',
  homeNewDesign: 'New design',
  homeViewOnlyTip: 'You can view this file',
  homeSharedTip: 'Shared with people outside the workspace',
  homeShared: 'Shared',
  syncSynced: 'Saved to Cloud',
  syncUploading: 'Uploading changes…',
  syncPending: 'Changes saved on this device, waiting to upload',
  syncOffline: 'Offline — changes are saved on this device',
  syncConflict: 'Edited elsewhere too — choose which version to keep',
  syncError: 'Could not upload changes',
  shareLinkFailed: 'This link doesn’t open a document. Ask for a new one.',
  shareOpenedInBrowser: 'Opened in the browser',
  openInDesktopApp: 'Open in the desktop app'
} as const

export const cloudMessages = i18n('cloud', cloudMessageDefaults)
