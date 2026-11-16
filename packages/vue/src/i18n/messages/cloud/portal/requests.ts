import { params } from '@nanostores/i18n'

/**
 * Messages of the `cloudPortal` namespace for access requests: deciding each one, and on the
 * official server, approving everyone waiting at once, each with the founder's letter.
 */
export const requestPortalMessageDefaults = {
  decline: 'Decline',
  removeAccess: 'Remove access',
  declineHeading: params('Decline {name}?'),
  declineDescription: 'They get an email saying so, and can ask again later.',
  removeAccessHeading: params('Remove access for {name}?'),
  removeAccessDescription: 'They can’t sign in any more, and get an email saying so.',
  reviewNote: 'Note for administrators (optional)',
  noteDetail: params('Note: {note}'),
  noOneWaiting: 'No one is waiting',
  nothingHere: 'Nothing here yet',
  requestsEmptyDescription: 'New requests appear here, and administrators get an email for each.',
  inviteWaitingHeading: 'Invite everyone waiting',
  inviteWaitingDescription:
    'Approves every waiting request and emails each person the founder’s letter about the beta.',
  inviteWaiting: 'Approve and invite',
  inviteWaitingConfirmHeading: 'Approve and invite everyone waiting?',
  inviteWaitingConfirmDescription:
    'Each person gets one email: Cloud is open, it’s still a beta, and where to report problems. They can sign in right away.',
  invitationsSent: 'Invitations are on their way.'
}
