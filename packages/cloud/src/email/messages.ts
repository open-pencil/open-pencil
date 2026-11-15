import { params } from '@nanostores/i18n'

/**
 * Every email's words in English, translated under `locales/`. A name, address, or document in a
 * placeholder is someone's own text and stays as they wrote it.
 */
export const emailMessageDefaults = {
  greeting: params('Hi {name},'),
  greetingWithoutName: 'Hi,',
  someone: 'Someone',
  openCloud: 'Open OpenPencil Cloud',
  footer: 'OpenPencil, the open-source design editor',
  invitationExpires: params('This invitation expires on {date}.'),

  documentInvitationHeading: 'You’re invited to a document',
  documentInvitationViewSubject: params('{inviter} invited you to view “{document}”'),
  documentInvitationEditSubject: params('{inviter} invited you to edit “{document}”'),
  documentInvitationView: params('{inviter} invited you to view “{document}” on OpenPencil Cloud.'),
  documentInvitationEdit: params('{inviter} invited you to edit “{document}” on OpenPencil Cloud.'),
  documentInvitationAction: 'Open document',

  workspaceInvitationSubject: params('{inviter} invited you to {workspace}'),
  workspaceInvitationHeading: params('Join {workspace}'),
  workspaceInvitationAdmin: params(
    '{inviter} invited you to manage the workspace “{workspace}” on OpenPencil Cloud.'
  ),
  workspaceInvitationEditor: params(
    '{inviter} invited you to edit in the workspace “{workspace}” on OpenPencil Cloud.'
  ),
  workspaceInvitationViewer: params(
    '{inviter} invited you to view the workspace “{workspace}” on OpenPencil Cloud.'
  ),
  workspaceInvitationHome: 'You’ll see its documents on Home once you join.',
  workspaceInvitationAction: 'Join workspace',

  enrollmentRequestedSubject: 'We received your OpenPencil Cloud request',
  enrollmentRequestedHeading: 'Request received',
  enrollmentRequestedPreview: 'Your OpenPencil Cloud access request is awaiting review.',
  enrollmentRequested: 'Your request is awaiting review. We’ll write again once it’s decided.',
  enrollmentApprovedSubject: 'Your OpenPencil Cloud access is ready',
  enrollmentApprovedHeading: 'Access approved',
  enrollmentApprovedPreview: 'You can now sign in to OpenPencil Cloud.',
  enrollmentApproved: 'Your access request was approved, so you can sign in now.',
  enrollmentApprovedAction: 'Sign in',
  enrollmentRejectedSubject: 'Your OpenPencil Cloud request was reviewed',
  enrollmentRejectedHeading: 'Request reviewed',
  enrollmentRejectedPreview: 'Your access request was not approved.',
  enrollmentRejected: 'Your access request was not approved this time.',
  enrollmentRejectedAction: 'Request access again',
  enrollmentRevokedSubject: 'Your OpenPencil Cloud access has changed',
  enrollmentRevokedHeading: 'Access changed',
  enrollmentRevokedPreview: 'Your OpenPencil Cloud access is no longer active.',
  enrollmentRevoked: 'Your OpenPencil Cloud access is no longer active.',
  enrollmentRevokedAction: 'Open OpenPencil',

  enrollmentNotificationSubject: 'New OpenPencil Cloud access request',
  enrollmentNotificationHeading: 'New access request',
  enrollmentNotificationPreview: params('{email} requested OpenPencil Cloud access.'),
  enrollmentNotification: params('{name} ({email}) requested access and wrote:'),
  enrollmentNotificationAction: 'Review request',

  documentReportSubject: 'A shared OpenPencil Cloud document was reported',
  documentReportHeading: 'A shared document was reported',
  documentReportPreview: params('“{document}” was reported for {reason}.'),
  documentReport: params(
    'Someone who opened “{document}” from a share link reported it for {reason} and wrote:'
  ),
  documentReportAction: 'Review report',
  reportReasonSpamPhishing: 'spam or phishing',
  reportReasonIllegal: 'illegal content',
  reportReasonCopyright: 'copyright',
  reportReasonHarassment: 'harassment',
  reportReasonOther: 'something else',

  verifyAccountSubject: 'Confirm your OpenPencil Cloud email',
  verifyAccountHeading: 'Confirm your email',
  verifyAccountPreview: 'One click to finish creating your OpenPencil Cloud account.',
  verifyAccount:
    'Confirm this address to finish creating your OpenPencil Cloud account. Then go back to OpenPencil; it signs you in by itself.',
  verifyAccountNote: 'Didn’t create an account? Ignore this email and nothing happens.',
  verifyChangeSubject: 'Confirm your new OpenPencil Cloud email',
  verifyChangeHeading: 'Confirm your new email',
  verifyChangePreview: 'One click to move your OpenPencil Cloud account to this address.',
  verifyChange:
    'Confirm this address to make it your OpenPencil Cloud account’s email. Your old address stays until you do.',
  verifyChangeNote: 'Didn’t ask for this? Ignore this email and nothing changes.',
  verifyAction: 'Confirm email',

  passwordResetSubject: 'Reset your OpenPencil Cloud password',
  passwordResetHeading: 'Reset your password',
  passwordResetPreview: 'Use this secure link to choose a new password.',
  passwordReset: 'Use the link below to choose a new password.',
  passwordResetNote: 'Didn’t ask for this? Ignore this email and your password stays the same.',
  passwordResetAction: 'Reset password',

  passwordChangedSubject: 'Your OpenPencil Cloud password changed',
  passwordChangedHeading: 'Password changed',
  passwordChangedPreview: 'Your OpenPencil Cloud password was changed.',
  passwordChanged: 'Your password was changed. If this wasn’t you, contact your administrator.',

  emailChangeSubject: 'Your OpenPencil Cloud email is changing',
  emailChangeHeading: 'Your email is changing',
  emailChangePreview: params('Your OpenPencil Cloud email is changing to {email}.'),
  emailChange: params(
    'Someone signed in to your account asked to change its email to {email}. It changes once that address confirms it.'
  ),
  emailChangeNotYou:
    'If this wasn’t you, change your password and sign out of your other sessions.',
  reviewAccount: 'Review your account',

  newSignInSubject: 'New sign-in to your OpenPencil Cloud account',
  newSignInHeading: 'New sign-in to your account',
  newSignInPreview: params('Your OpenPencil Cloud account was signed in to with {device}.'),
  newSignIn: params('Your account was signed in to with {device} on {date}.'),
  newSignInFrom: params('Your account was signed in to with {device} from {address} on {date}.'),
  newSignInNotYou:
    'If this was you, there’s nothing to do. If it wasn’t, sign that session out and change your password.',
  newSignInApp: 'the OpenPencil app',
  newSignInBrowser: params('{browser} on {system}'),
  newSignInUnknownBrowser: 'an unknown browser',
  reviewSessions: 'Review sessions',

  twoStepSubject: 'How you sign in to OpenPencil Cloud changed',
  authenticatorOnHeading: 'Authenticator app turned on',
  authenticatorOn: 'An authenticator app now confirms your sign-ins.',
  authenticatorOffHeading: 'Authenticator app turned off',
  authenticatorOff: 'Your sign-ins no longer ask for a code from an authenticator app.',
  passkeyAddedHeading: 'Passkey added',
  passkeyAdded: 'A passkey was added to your account.',
  passkeyRemovedHeading: 'Passkey removed',
  passkeyRemoved: 'A passkey was removed from your account.',
  twoStepResetHeading: 'Two-step sign-in was reset',
  twoStepReset:
    'An administrator removed your authenticator app, recovery codes, and passkeys, so you can set them up again.',
  twoStepNotYou: 'If this wasn’t you, change your password and contact your administrator.',
  reviewSecurity: 'Review security',

  storageFullSubject: 'Your OpenPencil Cloud files are read-only',
  storageFullHeading: 'Your storage is full',
  storageFullPreview: params(
    'Your OpenPencil Cloud files use {used} of {limit}, so they’re read-only.'
  ),
  storageFull: params(
    'Your workspaces hold {used}, and your plan includes {limit}. Until they hold less, your documents open and download but take no edits or new files.'
  ),
  storageFullUpgrade: 'Get more storage, or delete documents and empty the trash, to edit again.',
  storageFullFreeSpace: 'Delete documents and empty the trash to edit again.',
  storageFullAction: 'Get more storage',

  documentBlockedSubject: params('Your document “{document}” was blocked'),
  documentBlockedHeading: 'A document of yours was blocked',
  documentBlocked: params(
    'An administrator of OpenPencil Cloud blocked your document “{document}”. Nobody can open it, you included, until it’s restored. Nothing in it was deleted.'
  ),
  documentBlockedReason: params('The reason they gave: {reason}'),
  documentBlockedContest: params(
    'If you think this is a mistake, write to {email} to have it looked at again.'
  ),
  documentBlockedContestAdministrators:
    'If you think this is a mistake, ask the server’s administrators to look at it again.',
  documentRestoredSubject: params('Your document “{document}” is back'),
  documentRestoredHeading: 'Your document is back',
  documentRestored: params(
    'An administrator restored your document “{document}”. It opens again for you and everyone you shared it with.'
  ),
  openHome: 'Open Home',
  reportReceivedSubject: params('We received your report about “{document}”'),
  reportReceivedHeading: 'Report received',
  reportReceived: params(
    'Thanks for reporting “{document}”. The server’s administrators review every report and decide whether it breaks the rules. We’ll write again when they have.'
  ),
  reportDecidedSubject: params('Your report about “{document}”'),
  reportBlockedHeading: 'The document was blocked',
  reportBlocked: params(
    'The administrators reviewed your report and blocked “{document}”, so nobody can open it until it’s restored.'
  ),
  reportActionedHeading: 'Your report was acted on',
  reportActioned: params(
    'The administrators reviewed your report about “{document}” and took action on it.'
  ),
  reportDismissedHeading: 'The document stays',
  reportDismissed: params(
    'The administrators reviewed your report about “{document}” and found it doesn’t break the rules, so it stays as it is.'
  ),
  reportDisagree: params('If you disagree, write to {email}.'),
  reportDisagreeAdministrators:
    'If you disagree, ask the server’s administrators to look at it again.',

  waitlistSubject: 'Confirm your place on the OpenPencil Cloud waitlist',
  waitlistHeading: 'Confirm your email',
  waitlistPreview: 'One click to join the OpenPencil Cloud waitlist.',
  waitlist:
    'Thanks for your interest in OpenPencil Cloud. Confirm this address to join the waitlist, and we’ll write once, when Cloud is ready for you.',
  waitlistAction: 'Join the waitlist',
  waitlistNote:
    'Didn’t sign up? Ignore this email and the address is deleted in seven days, or {link}.',
  waitlistLeave: 'remove it now'
}

export type EmailMessageDefaults = typeof emailMessageDefaults
